import { animateElement } from "../../../animate/element"
import { frame } from "../../../../frameloop"
import { styleEffect } from "../../../../effects/style"
import { motionValue } from "../../../../value"

/**
 * JSDOM has no WAAPI, so record what would be sent to Element.animate().
 */
interface MockAnimation {
    element: Element
    keyframes: { transform: string[] } | null
    options: KeyframeAnimationOptions
    startTime: number | null
    currentTime: number | null
    playbackRate: number
    onfinish: (() => void) | null
    cancel: jest.Mock
    pause: jest.Mock
}

let animations: MockAnimation[] = []

beforeAll(() => {
    Object.defineProperty(Element.prototype, "animate", {
        configurable: true,
        writable: true,
        value(
            this: Element,
            keyframes: MockAnimation["keyframes"],
            options: any
        ) {
            let timer: ReturnType<typeof setTimeout> | undefined
            let startTime: number | null = null

            /**
             * Finish at the end of the (finite) animation, like WAAPI.
             */
            const animation: MockAnimation = {
                element: this,
                keyframes,
                options,
                currentTime: null,
                playbackRate: 1,
                onfinish: null,
                get startTime() {
                    return startTime
                },
                set startTime(value) {
                    startTime = value
                    clearTimeout(timer)
                    const { duration, iterations = 1 } = options
                    if (value === null || iterations === Infinity) return
                    timer = setTimeout(
                        () => animation.onfinish?.(),
                        Math.max(
                            0,
                            value +
                                (duration * iterations) /
                                    animation.playbackRate -
                                performance.now()
                        )
                    )
                },
                cancel: jest.fn(() => clearTimeout(timer)),
                pause: jest.fn(() => clearTimeout(timer)),
            }
            animations.push(animation)
            return animation
        },
    })
})

afterAll(() => {
    delete (Element.prototype as any).animate
})

beforeEach(() => {
    animations = []
})

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * WAAPI transform animations on an element that haven't been cancelled.
 */
const running = (element: Element) =>
    animations.filter(
        (animation) =>
            animation.element === element &&
            animation.keyframes &&
            !animation.cancel.mock.calls.length
    ) as Array<MockAnimation & { keyframes: { transform: string[] } }>

const readX = (transform: string) =>
    parseFloat(transform.match(/translateX\(([\d.]+)px\)/)![1])

describe("independent transform acceleration", () => {
    it("composes every transform on an element into one WAAPI animation", async () => {
        const element = document.createElement("div")

        animateElement(
            element,
            { x: [0, 100], scale: [1, 2] },
            { duration: 1, ease: "linear" }
        )
        await nextFrame()

        expect(running(element)).toHaveLength(1)
        const [{ keyframes, options, startTime }] = running(element)
        const { transform } = keyframes

        /**
         * Sampled from now, which is a little after the animation started,
         * until it ends.
         */
        expect(readX(transform[0])).toBeLessThan(10)
        expect(transform[transform.length - 1]).toBe(
            "translateX(100px) scale(2) "
        )
        for (let i = 1; i < transform.length; i++) {
            expect(readX(transform[i])).toBeGreaterThan(readX(transform[i - 1]))
        }
        expect(options.easing).toBe("linear")
        expect(options.duration).toBeGreaterThan(900)
        expect(options.duration).toBeLessThanOrEqual(1000)
        expect(startTime).not.toBe(null)
    })

    it("includes transforms that aren't animating", async () => {
        const element = document.createElement("div")
        const rotate = motionValue(45)
        styleEffect(element, { rotate })

        animateElement(element, { x: [0, 100] }, { duration: 0.1 })
        await nextFrame()

        const { transform } = running(element)[0].keyframes
        expect(transform[0]).toMatch(
            /^translateX\([\d.]+px\) rotate\(45deg\) $/
        )
        expect(transform[transform.length - 1]).toBe(
            "translateX(100px) rotate(45deg) "
        )
    })

    it("doesn't write styles on the main thread while animating", async () => {
        const element = document.createElement("div")

        animateElement(element, { x: [0, 100] }, { duration: 1 })
        await nextFrame()
        await nextFrame()
        const style = element.style.transform
        await wait(50)
        await nextFrame()

        expect(element.style.transform).toBe(style)
    })

    it("rebuilds when another value starts, keeping one animation", async () => {
        const element = document.createElement("div")

        animateElement(
            element,
            { x: [0, 100] },
            { duration: 1, ease: "linear" }
        )
        await nextFrame()
        await wait(100)

        animateElement(
            element,
            { scale: [1, 2] },
            { duration: 1, ease: "linear" }
        )
        await nextFrame()

        expect(animations.length).toBeGreaterThan(1)
        expect(running(element)).toHaveLength(1)
        const [first] = running(element)[0].keyframes.transform
        // x carries on from where it was.
        expect(readX(first)).toBeGreaterThan(5)
        expect(readX(first)).toBeLessThan(40)
        const scale = parseFloat(first.match(/scale\(([\d.]+)\)/)![1])
        expect(scale).toBeGreaterThanOrEqual(1)
        expect(scale).toBeLessThan(1.1)
    })

    it("writes the final transform and cancels the animation on finish", async () => {
        const element = document.createElement("div")

        await Promise.all(
            animateElement(element, { x: [0, 100] }, { duration: 0.05 })
        )
        await nextFrame()

        expect(running(element)).toHaveLength(0)
        expect(element.style.transform).toBe("translateX(100px)")
    })

    it("hands velocity to an interrupting animation", async () => {
        const element = document.createElement("div")

        animateElement(
            element,
            { x: [0, 100] },
            { duration: 1, ease: "linear" }
        )
        await nextFrame()
        await wait(100)

        const x = styleEffect.get(element, "x")!
        animateElement(element, { x: 0 }, { duration: 1 })

        // ~100px per second, sampled from the WAAPI animation's timing.
        expect(x.getVelocity()).toBeGreaterThan(80)
        expect(x.getVelocity()).toBeLessThan(120)
    })

    it("moves to the main thread when a value can't be accelerated", async () => {
        const element = document.createElement("div")

        animateElement(element, { x: [0, 100] }, { duration: 1 })
        await nextFrame()
        expect(running(element)).toHaveLength(1)

        animateElement(
            element,
            { y: [0, 100] },
            { type: "inertia", velocity: 500 }
        )
        await nextFrame()
        expect(running(element)).toHaveLength(0)

        // Both values now render on the main thread.
        const style = element.style.transform
        await wait(50)
        await nextFrame()
        expect(element.style.transform).not.toBe(style)
        expect(element.style.transform).toContain("translateX")
        expect(element.style.transform).toContain("translateY")
    })

    it("moves to the main thread when another source keeps writing a transform", async () => {
        const element = document.createElement("div")
        const rotate = motionValue(0)
        styleEffect(element, { rotate })

        animateElement(element, { x: [0, 100] }, { duration: 1 })
        await nextFrame()
        expect(running(element)).toHaveLength(1)

        // One outside write rebuilds the animation with the new value.
        rotate.set(10)
        await nextFrame()
        expect(running(element)).toHaveLength(1)
        expect(running(element)[0].keyframes.transform[0]).toContain(
            "rotate(10deg)"
        )

        // Writing every frame moves it to the main thread.
        rotate.set(20)
        await nextFrame()
        expect(running(element)).toHaveLength(0)
        expect(element.style.transform).toContain("rotate(20deg)")
    })

    it("uses two keyframes and the shared easing when values share a transition", async () => {
        const element = document.createElement("div")

        animateElement(
            element,
            { x: [0, 100], scale: [1, 2] },
            { duration: 1, ease: "easeOut" }
        )
        await nextFrame()

        const [{ keyframes, options }] = running(element)
        expect(keyframes.transform).toHaveLength(2)
        expect(keyframes.transform[1]).toBe("translateX(100px) scale(2) ")
        expect(options.easing).toMatch(/^linear\(0,/)
    })

    it("uses two keyframes for springs that share a transition", async () => {
        const element = document.createElement("div")

        animateElement(
            element,
            { x: [0, 100], rotate: [0, 90] },
            { type: "spring", stiffness: 300, damping: 20 }
        )
        await nextFrame()

        const [{ keyframes, options }] = running(element)
        expect(keyframes.transform).toHaveLength(2)
        expect(options.easing).toMatch(/^linear\(/)
    })

    it("samples few keyframes when values have different transitions", async () => {
        const element = document.createElement("div")

        animateElement(
            element,
            { x: [0, 100] },
            { duration: 1, ease: "easeOut" }
        )
        animateElement(
            element,
            { scale: [1, 2] },
            { duration: 0.5, ease: "easeIn" }
        )
        await nextFrame()

        const [{ keyframes, options }] = running(element)
        const { transform, offset } = keyframes as any
        expect(options.easing).toBe("linear")
        expect(offset).toHaveLength(transform.length)
        expect(transform.length).toBeGreaterThan(2)
        // Far fewer than one per 10ms.
        expect(transform.length).toBeLessThan(40)
    })

    it("pauses, seeks and plays the WAAPI animation without rebuilding it", async () => {
        const element = document.createElement("div")

        const animation = animateElement(
            element,
            { x: [0, 100], y: [0, 100] },
            { duration: 1, ease: "linear" }
        )
        await nextFrame()
        const [waapi] = running(element)
        const count = animations.length

        animation.forEach((a) => a.pause())
        await nextFrame()
        expect(waapi.pause).toHaveBeenCalled()

        animation.forEach((a) => (a.time = 0.5))
        await nextFrame()
        // The WAAPI animation starts where it was built, a frame in.
        expect(waapi.currentTime).toBeGreaterThan(450)
        expect(waapi.currentTime).toBeLessThanOrEqual(500)

        animation.forEach((a) => a.play())
        await nextFrame()
        expect(waapi.playbackRate).toBe(1)

        animation.forEach((a) => (a.speed = 2))
        await nextFrame()
        expect(waapi.playbackRate).toBe(2)

        expect(animations.length).toBe(count)
        expect(running(element)).toEqual([waapi])
    })

    it("finishes an animation that ends sooner on its own finish event", async () => {
        const element = document.createElement("div")
        let finishedAt = 0
        const start = performance.now()

        animateElement(element, { x: [0, 100] }, { duration: 1 })
        const [short] = animateElement(
            element,
            { scale: [1, 2] },
            { duration: 0.1 }
        )
        short.then(() => (finishedAt = performance.now() - start))
        await wait(250)

        expect(finishedAt).toBeGreaterThan(80)
        expect(finishedAt).toBeLessThan(200)
        // x is still running on the compositor.
        expect(running(element)).toHaveLength(1)
    })

    it("stays on the main thread for SVG elements", async () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
        )

        animateElement(element, { x: [0, 100] }, { duration: 1 })
        await nextFrame()

        expect(animations).toHaveLength(0)
    })
})
