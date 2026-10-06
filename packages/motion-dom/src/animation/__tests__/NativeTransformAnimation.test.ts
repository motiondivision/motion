import { time } from "../../frameloop/sync-time"
import { motionValue, MotionValue } from "../../value"
import { JSAnimation } from "../JSAnimation"
import {
    NativeTransformAnimation,
    syncTransformGroups,
} from "../NativeTransformAnimation"

function createOwner() {
    const element = document.createElement("div")
    const latestValues: Record<string, any> = {}
    const renderState: Record<string, any> = {}
    return {
        element,
        latestValues,
        renderState,
        current: element,
        getProps: () => ({}),
        bind(name: string, value: MotionValue) {
            latestValues[name] = value.get()
            value.on("change", (v) => (latestValues[name] = v))
            value.owner = this as any
        },
    }
}

function createMockAnimation() {
    return {
        cancel: jest.fn(),
        pause: jest.fn(),
        play: jest.fn(),
        onfinish: null as null | VoidFunction,
        playbackRate: 1,
        currentTime: 0,
        startTime: time.now(),
        playState: "running",
        effect: {
            setKeyframes: jest.fn(),
            getComputedTiming: () => ({ duration: 1000 }),
            updateTiming: jest.fn(),
        },
    }
}

describe("NativeTransformAnimation", () => {
    let animations: ReturnType<typeof createMockAnimation>[]
    let animate: jest.Mock

    beforeEach(() => {
        animations = []
        animate = jest.fn().mockImplementation(() => {
            const animation = createMockAnimation()
            animations.push(animation)
            return animation
        })
        Element.prototype.animate = animate
    })

    afterEach(() => {
        ;(Element.prototype as any).animate = undefined
    })

    function start(
        owner: ReturnType<typeof createOwner>,
        name: string,
        keyframes: any[],
        options: Record<string, any> = {}
    ) {
        const value = motionValue(keyframes[0])
        owner.bind(name, value)
        const swap = jest.fn()
        const onComplete = jest.fn()
        const animation = new NativeTransformAnimation(
            {
                element: owner.element,
                name,
                keyframes,
                motionValue: value,
                duration: 1000,
                ease: "linear",
                onComplete,
                ...options,
            } as any,
            swap
        )
        return { animation, value, swap, onComplete }
    }

    test("values sharing a property that start together share one animation", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])
        const y = start(owner, "y", [0, 50])
        start(owner, "scale", [1, 2])

        expect(owner.renderState.independentTransforms).toBe(true)
        // The element moves onto the individual properties straight away
        expect(owner.element.style.transform).toBe("none")
        expect((owner.element.style as any).translate).toBe("none")

        expect(animate).toHaveBeenCalledTimes(2)
        expect(animate.mock.calls[0][0]).toEqual({
            translate: ["0px 0px", "100px 0px"],
        })
        expect(animate.mock.calls[0][1]).toMatchObject({
            duration: 1000,
            easing: "linear",
            fill: "both",
            iterations: 1,
        })
        expect(animations[0].effect.setKeyframes).toHaveBeenCalledWith({
            translate: ["0px 0px", "100px 50px"],
        })
        expect(animate.mock.calls[1][0]).toEqual({ scale: ["1", "2"] })

        expect(x.animation.duration).toBe(1)
        expect(y.animation.duration).toBe(1)
    })

    test("finishing sets every value and commits the property before cancelling", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])
        const y = start(owner, "y", [0, 50])

        animations[0].currentTime = 1000
        animations[0].onfinish!()

        expect(x.value.get()).toBe(100)
        expect(y.value.get()).toBe(50)
        expect((owner.element.style as any).translate).toBe("100px 50px")
        expect(animations[0].cancel).toHaveBeenCalledTimes(1)
        expect(x.onComplete).toHaveBeenCalledTimes(1)
        expect(y.onComplete).toHaveBeenCalledTimes(1)
        expect(x.animation.state).toBe("finished")
    })

    test("a value with different timing moves the property to the main thread", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])

        // A later frame
        time.set(time.now() + 500)
        animations[0].currentTime = 500

        expect(() => start(owner, "y", [0, 50], { duration: 2000 })).toThrow()

        expect(animations[0].cancel).toHaveBeenCalledTimes(1)
        expect(x.swap).toHaveBeenCalledTimes(1)
        const js = x.swap.mock.calls[0][0]
        expect(js).toBeInstanceOf(JSAnimation)
        expect(js.time).toBeCloseTo(0.5, 1)
        // The main thread animation continues from the current value
        expect(x.value.get()).toBeCloseTo(50, 0)
        expect((owner.element.style as any).translate).toBe("50px 0px")
    })

    test("stopping one value of a shared property samples it and demotes the rest", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])
        const y = start(owner, "y", [0, 50])

        time.set(time.now() + 250)
        animations[0].currentTime = 250
        x.animation.stop()

        expect(x.value.get()).toBeGreaterThan(0)
        expect(x.value.get()).toBeLessThan(100)
        expect(x.swap).not.toHaveBeenCalled()
        expect(y.swap).toHaveBeenCalledTimes(1)
        expect(animations[0].cancel).toHaveBeenCalledTimes(1)
    })

    test("stopping the last value cancels the animation", () => {
        const owner = createOwner()
        const scale = start(owner, "scale", [1, 2])

        time.set(time.now() + 250)
        scale.animation.stop()

        expect(scale.value.get()).toBeGreaterThan(1)
        expect(animations[0].cancel).toHaveBeenCalledTimes(1)

        // A new animation on the property is accelerated again
        start(owner, "scale", [1.2, 3])
        expect(animate).toHaveBeenCalledTimes(2)
    })

    test("main thread changes to a sibling value demote the property", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])
        const y = motionValue(0)
        owner.bind("y", y)

        syncTransformGroups(owner.element, owner.latestValues)
        expect(x.swap).not.toHaveBeenCalled()

        animations[0].currentTime = 100
        y.set(20)
        syncTransformGroups(owner.element, owner.latestValues)

        expect(x.swap).toHaveBeenCalledTimes(1)
        expect(animations[0].cancel).toHaveBeenCalledTimes(1)
    })

    test("a transform without an individual property demotes every group", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])
        const rotate = start(owner, "rotate", [0, 90])

        owner.latestValues.skewX = 10
        syncTransformGroups(owner.element, owner.latestValues)

        expect(x.swap).toHaveBeenCalledTimes(1)
        expect(rotate.swap).toHaveBeenCalledTimes(1)
    })

    test("a demoted animation continues from the native start time", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])
        const y = motionValue(0)
        owner.bind("y", y)

        /**
         * The native animation's time is that of the last frame. The main
         * thread is later than that when the hand-off happens, so measuring
         * from now would lose up to a frame.
         */
        const startTime = animations[0].startTime
        animations[0].currentTime = 500
        time.set(startTime + 512)

        y.set(20)
        syncTransformGroups(owner.element, owner.latestValues)

        const js = x.swap.mock.calls[0][0] as JSAnimation<number>
        expect(js.startTime).toBeCloseTo(startTime, 5)
        expect(js.state).toBe("running")
        expect(x.value.get()).toBe(50)
        expect(x.value.getVelocity()).toBeCloseTo(100, -1)
    })

    test("a paused native animation is demoted paused", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])
        const y = motionValue(0)
        owner.bind("y", y)

        animations[0].playState = "paused"
        animations[0].currentTime = 300
        time.set(time.now() + 1000)

        y.set(20)
        syncTransformGroups(owner.element, owner.latestValues)

        const js = x.swap.mock.calls[0][0] as JSAnimation<number>
        expect(js.state).toBe("paused")
        expect(js.time).toBe(0.3)
        expect(x.value.get()).toBe(30)
        expect(x.value.getVelocity()).toBe(0)
    })

    test("stopping samples the native current time, not the elapsed time", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])

        // Playing at double speed: 250ms elapsed, 500ms of animation time
        animations[0].playbackRate = 2
        animations[0].currentTime = 500
        time.set(time.now() + 250)
        x.animation.stop()

        expect(x.value.get()).toBe(50)
        expect(x.value.getVelocity()).toBeCloseTo(200, -1)

        const scale = start(owner, "scale", [1, 2])
        animations[1].playState = "paused"
        animations[1].currentTime = 300
        time.set(time.now() + 1000)
        scale.animation.stop()

        expect(scale.value.get()).toBe(1.3)
        expect(scale.value.getVelocity()).toBe(0)
    })

    test("pause, seek and speed use the native animation", () => {
        const owner = createOwner()
        const x = start(owner, "x", [0, 100])

        x.animation.pause()
        expect(animations[0].pause).toHaveBeenCalled()
        x.animation.time = 0.5
        expect(animations[0].currentTime).toBe(500)
        x.animation.speed = 2
        expect(animations[0].playbackRate).toBe(2)
        expect(animate).toHaveBeenCalledTimes(1)
    })
})
