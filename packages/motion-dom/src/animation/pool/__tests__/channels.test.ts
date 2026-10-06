import { MotionGlobalConfig } from "motion-utils"
import { frame } from "../../../frameloop"
import { frameData } from "../../../frameloop/frame-data"
import { time } from "../../../frameloop/sync-time"
import { motionValue } from "../../../value"
import { styleSubjectEffect } from "../../../effects/style"
import { animateElement } from "../../animate/element"
import { Pool } from "../Pool"
import { canAccelerate } from "../channels"
import { supportsFlags } from "../../../utils/supports/flags"

/**
 * JSDOM has no WAAPI. This stands in for it: it records what the channels
 * ask of the browser and lets tests finish an animation or inspect the
 * element at the moment it was cancelled.
 */
class FakeAnimation {
    currentTime: number | null = 0
    startTime: number | null = null
    playbackRate = 1
    playState = "running"
    onfinish: VoidFunction | null = null
    cancelled = false
    styleAtCancel: Record<string, string> = {}
    effect = {
        setKeyframes: jest.fn(),
    }

    constructor(
        public element: HTMLElement,
        public keyframes: Record<string, any>,
        public options: KeyframeAnimationOptions
    ) {}

    pause() {
        this.playState = "paused"
    }

    play() {
        this.playState = "running"
    }

    cancel() {
        this.cancelled = true
        this.playState = "idle"
        const { style } = this.element
        this.styleAtCancel = {
            transform: style.transform,
            translate: (style as any).translate,
            scale: (style as any).scale,
            rotate: (style as any).rotate,
            opacity: style.opacity,
        }
    }

    finish() {
        this.onfinish?.()
    }
}

const animations: FakeAnimation[] = []

Element.prototype.animate = function (keyframes: any, options: any): Animation {
    const animation = new FakeAnimation(this as HTMLElement, keyframes, options)
    /**
     * Feature probes animate detached elements; only record ours.
     */
    if ((this as HTMLElement).isConnected) animations.push(animation)
    return animation as unknown as Animation
}

/**
 * Manual timing keeps time.now() at the frame timestamp, so tests can
 * place the clock exactly.
 */
function setTime(timestamp: number) {
    frameData.timestamp = timestamp
    time.set(timestamp)
}

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const linear = { duration: 0.1, ease: "linear" } as const

function createElement() {
    const element = document.createElement("div")
    document.body.appendChild(element)
    return element
}

beforeEach(() => {
    animations.length = 0
    MotionGlobalConfig.useManualTiming = true
    /**
     * JSDOM has no individual transform properties; pretend it does so
     * the channels accelerate transforms as a current browser would.
     */
    supportsFlags.individualTransforms = true
    setTime(0)
})

afterEach(() => {
    MotionGlobalConfig.useManualTiming = false
    supportsFlags.individualTransforms = undefined
})

describe("channels", () => {
    test("x and y share one accelerated translate animation", () => {
        const element = createElement()
        const [pool] = animateElement(
            element,
            { x: [0, 100], y: [0, 50] },
            linear
        )

        expect(animations.length).toBe(1)
        const [animation] = animations
        expect(animation.keyframes).toEqual({
            translate: ["0px 0px", "100px 50px"],
        })
        expect(animation.options).toMatchObject({
            duration: 100,
            easing: "linear",
            fill: "both",
            iterations: 1,
        })
        expect(animation.startTime).toBe(0)

        /**
         * While accelerated the element renders through the individual
         * transform properties.
         */
        expect(element.style.transform).toBe("none")
        expect(pool.state).toBe("running")
    })

    test("each transform property gets its own animation", () => {
        const element = createElement()
        animateElement(
            element,
            { x: [0, 100], scale: [1, 2], rotate: [0, 90] },
            linear
        )

        expect(animations.map((a) => Object.keys(a.keyframes)[0])).toEqual([
            "translate",
            "scale",
            "rotate",
        ])
        expect(animations[1].keyframes.scale).toEqual(["1", "2"])
        expect(animations[2].keyframes.rotate).toEqual(["0deg", "90deg"])
    })

    test("a main-thread value only blocks its own property", async () => {
        const element = createElement()
        const onUpdate = jest.fn()
        animateElement(
            element,
            { x: [0, 100], rotate: [0, 90] },
            { ...linear, rotate: { ...linear, onUpdate } }
        )

        expect(animations.length).toBe(1)
        expect(Object.keys(animations[0].keyframes)).toEqual(["translate"])

        setTime(50)
        await nextFrame()

        expect(onUpdate).toHaveBeenCalledWith(45)
        expect(element.style.transform).toBe("none")
        expect((element.style as any).rotate).toMatch(/deg$/)
    })

    test("springs are sampled into a linear() easing", () => {
        const element = createElement()
        animateElement(
            element,
            { x: [0, 100] },
            { type: "spring", stiffness: 300, damping: 20 }
        )

        expect(animations.length).toBe(1)
        expect(animations[0].options.easing).toMatch(/^linear\(/)
    })

    test("an interrupting animation reads the value and velocity from the track", () => {
        const element = createElement()
        animateElement(element, { x: [0, 100], y: [0, 100] }, linear)
        const [first] = animations
        const x = styleSubjectEffect.get(element, "x")!

        setTime(50)
        expect(x.get()).toBe(50)

        animateElement(element, { x: 200 }, linear)

        expect(x.getVelocity()).toBeCloseTo(1000)

        /**
         * y carries on in the first channel with x's value baked in, until
         * the second pool claims the property: two animations can't share
         * it, so both move to the main thread from where they were.
         */
        expect(first.effect.setKeyframes).toHaveBeenCalledWith({
            translate: ["50px 0px", "50px 100px"],
        })
        expect(first.cancelled).toBe(true)
        expect(first.styleAtCancel.transform).toBe(
            "translateX(50px) translateY(50px)"
        )
        expect(animations.length).toBe(1)
    })

    test("a released single-property channel writes its value before cancelling", () => {
        const element = createElement()
        animateElement(element, { opacity: [0, 1] }, linear)
        const [first] = animations
        expect(first.keyframes).toEqual({ opacity: [0, 1] })

        setTime(50)
        animateElement(element, { opacity: 0 }, linear)

        expect(first.cancelled).toBe(true)
        expect(first.styleAtCancel.opacity).toBe("0.5")
        expect(animations.length).toBe(2)
        expect(animations[1].keyframes).toEqual({ opacity: [0.5, 0] })
    })

    test("a finished channel commits its end value before cancelling", async () => {
        const element = createElement()
        const [pool] = animateElement(
            element,
            { x: [0, 100], opacity: [0, 1] },
            linear
        )
        const x = styleSubjectEffect.get(element, "x")!

        setTime(100)
        animations.forEach((animation) => animation.finish())

        expect(x.get()).toBe(100)
        expect(animations[0].styleAtCancel.transform).toBe("translateX(100px)")
        expect(animations[0].styleAtCancel.translate).toBe("")
        expect(animations[1].styleAtCancel.opacity).toBe("1")

        await Promise.resolve()
        expect(pool.state).toBe("finished")
        expect(x.isAnimating()).toBe(false)
    })

    test("pool controls apply natively", () => {
        const element = createElement()
        const [pool] = animateElement(element, { x: [0, 100] }, linear)
        const [animation] = animations

        setTime(20)
        pool.pause()
        expect(animation.playState).toBe("paused")
        expect(animation.currentTime).toBe(20)

        pool.time = 0.05
        expect(animation.currentTime).toBe(50)

        pool.play()
        expect(animation.playState).toBe("running")
        expect(animation.startTime).toBe(-30)

        pool.speed = 2
        expect(animation.playbackRate).toBe(2)
        expect(animation.cancelled).toBe(false)
    })

    test("complete() finishes channels", () => {
        const element = createElement()
        const [pool] = animateElement(element, { x: [0, 100] }, linear)
        const x = styleSubjectEffect.get(element, "x")!

        setTime(20)
        pool.complete()

        expect(animations[0].cancelled).toBe(true)
        expect(x.get()).toBe(100)
        expect(animations[0].styleAtCancel.transform).toBe("translateX(100px)")
    })

    test("a changed value baked into a channel demotes it at render", async () => {
        const element = createElement()
        const y = motionValue(10)
        const rotate = motionValue(45)
        styleSubjectEffect(element, { y, rotate })

        animateElement(element, { x: [0, 100] }, linear)
        const [animation] = animations
        expect(animation.keyframes.translate).toEqual([
            "0px 10px",
            "100px 10px",
        ])
        const x = styleSubjectEffect.get(element, "x")!

        /**
         * rotate is its own property, so changing it leaves the translate
         * animation alone.
         */
        setTime(50)
        rotate.set(90)
        await nextFrame()

        expect(animation.cancelled).toBe(false)
        expect(element.style.transform).toBe("none")
        expect((element.style as any).rotate).toBe("90deg")

        /**
         * y is baked into the translate keyframes, so the animation would
         * mask its new value: the channel moves to the main thread.
         */
        y.set(20)
        await nextFrame()

        expect(animation.cancelled).toBe(true)
        expect(animation.styleAtCancel.transform).toBe(
            "translateX(50px) translateY(20px) rotate(90deg)"
        )
        expect(x.isAnimating()).toBe(true)
    })

    test("values that can't be accelerated stay on the main thread", () => {
        const element = createElement()
        const owner = {
            current: element,
            getProps: () => ({}),
            getValue: () => undefined,
        }
        const track = (options: any) =>
            ({ options: { name: "x", keyframes: [0, 100], ...options } } as any)

        expect(canAccelerate(track({}), owner)).toBe(true)
        expect(canAccelerate(track({ onUpdate: () => {} }), owner)).toBe(false)
        expect(canAccelerate(track({ isHandoff: true }), owner)).toBe(false)
        expect(canAccelerate(track({ repeatDelay: 100 }), owner)).toBe(false)
        expect(canAccelerate(track({ type: "inertia" }), owner)).toBe(false)
        expect(
            canAccelerate(track({}), {
                ...owner,
                getProps: () => ({ transformTemplate: () => "" }),
            })
        ).toBe(false)
        expect(
            canAccelerate(track({}), {
                ...owner,
                projection: {
                    options: { layout: true },
                    isProjecting: () => false,
                },
            })
        ).toBe(false)
        expect(canAccelerate(track({ name: "skewX" }), owner)).toBe(false)
    })

    test("transforms stay on the main thread without individual transform properties", async () => {
        supportsFlags.individualTransforms = false
        const element = createElement()
        const [pool] = animateElement(
            element,
            { x: [0, 100], opacity: [0, 1] },
            linear
        )

        expect(animations.map((a) => Object.keys(a.keyframes)[0])).toEqual([
            "opacity",
        ])

        setTime(50)
        await nextFrame()

        expect(element.style.transform).toBe("translateX(50px)")
        expect((element.style as any).translate).toBeFalsy()
        expect(pool.state).toBe("running")
    })

    test("the pool starts at a fixed time when any value is accelerated", () => {
        const element = createElement()
        setTime(1000)
        const [pool] = animateElement(element, { x: [0, 100] }, linear)
        expect(pool).toBeInstanceOf(Pool)
        expect((pool as Pool).startTime).toBe(1000)
        expect(animations[0].startTime).toBe(1000)
    })
})
