import {
    appearElements,
    appearHandoff,
    frame,
    motionValue,
    type MotionValue,
} from "motion-dom"
import { createAppearAnimation } from "../css"
import { followAppearAnimations } from "../follow"

const linear = { duration: 2, ease: "linear" } as const

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

/**
 * JSDOM has no animations, so the CSS animation a browser would make from
 * the element's style is made here.
 */
function setup(initial: any, animate: any, currentTime: number) {
    const appear = createAppearAnimation(
        { initial, animate, transition: linear },
        { ...initial },
        null,
        undefined
    )!
    const element = document.createElement("div")
    const listeners: { [name: string]: VoidFunction } = {}
    const animations = Object.keys(appear.timings).map((animationName) => ({
        animationName,
        currentTime,
        startTime: 0,
        playState: "running",
        cancel: jest.fn(),
        addEventListener: (_: string, callback: VoidFunction) =>
            (listeners[animationName] = callback),
    }))
    let running = animations
    ;(element as any).getAnimations = () => running
    animations.forEach((animation) => {
        animation.cancel.mockImplementation(() => {
            running = running.filter((other) => other !== animation)
        })
    })
    element.style.animation = "m 1s"
    appearElements.set(element, appear)

    const values: { [key: string]: MotionValue<any> } = {}
    const resumed: string[] = []
    const visualElement = { current: element }

    const follow = (key: string, target = animate[key]) => {
        values[key] ||= motionValue(initial[key])
        const start = appearHandoff.current!(
            visualElement,
            key,
            values[key],
            target,
            linear
        )
        start && values[key].run(start)
        return start
    }

    return { element, animations, listeners, values, resumed, follow }
}

describe("followAppearAnimations", () => {
    beforeAll(followAppearAnimations)

    test("a value follows its CSS animation without being set", () => {
        const { values, follow } = setup({ opacity: 0 }, { opacity: 1 }, 500)

        expect(follow("opacity")).toBeTruthy()
        expect(values.opacity.isAnimating()).toBe(true)
        expect(values.opacity.getCurrent()).toBe(0)
        expect(values.opacity.get()).toBeCloseTo(0.25)
    })

    test("values of other elements and other animations aren't followed", () => {
        const { follow, element } = setup({ opacity: 0 }, { opacity: 1 }, 500)

        expect(follow("x", 100)).toBe(undefined)

        // Each value follows once, for the enter animation
        expect(follow("opacity")).toBeTruthy()
        expect(follow("opacity", 0.5)).toBe(undefined)

        appearElements.delete(element)
        expect(follow("opacity")).toBe(undefined)
    })

    test("a value takes its target when the CSS animation ends", async () => {
        const { values, follow, listeners, animations, element } = setup(
            { opacity: 0 },
            { opacity: 1 },
            500
        )
        follow("opacity")
        const onComplete = jest.fn()
        values.opacity.on("animationComplete", onComplete)

        listeners["m-opacity"]()

        expect(values.opacity.getCurrent()).toBe(1)
        expect(values.opacity.isAnimating()).toBe(false)
        expect(onComplete).toHaveBeenCalledTimes(1)

        // The CSS animation goes once the target has rendered
        expect(animations[0].cancel).not.toHaveBeenCalled()
        await nextFrame()
        await nextFrame()
        await nextFrame()
        expect(animations[0].cancel).toHaveBeenCalled()
        expect(element.style.animation).toBe("")
        expect(appearElements.has(element)).toBe(false)
    })

    test("another animation starts from where the CSS animation is", () => {
        const { values, follow, animations, element } = setup(
            { x: -200, scale: 0.5 },
            { x: 0, scale: 1 },
            1000
        )
        follow("x")
        follow("scale")

        expect(values.x.get()).toBeCloseTo(-100)
        expect(values.scale.get()).toBeCloseTo(0.75)

        values.scale.stop()

        // The stopped value has the value and velocity that were showing
        expect(values.scale.getCurrent()).toBeCloseTo(0.75)
        expect(values.scale.getVelocity()).toBeCloseTo(0.25)
        expect(values.scale.isAnimating()).toBe(false)

        // The other value of the transform carries on in an animation
        // of its own, from the time the CSS animation started
        expect(animations[0].cancel).toHaveBeenCalled()
        expect(values.x.isAnimating()).toBe(true)
        expect(values.x.get()).not.toBeCloseTo(-100)
        expect(element.style.animation).toBe("")
    })
})
