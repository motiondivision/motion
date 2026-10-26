import { AsyncMotionValueAnimation } from "../AsyncMotionValueAnimation"
import { syncDriver } from "./utils"

describe("AsyncMotionValueAnimation", () => {
    test("Keeps a startTime provided in options", async () => {
        const output: number[] = []

        await new Promise<void>((resolve) => {
            new AsyncMotionValueAnimation({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                driver: syncDriver(20),
                /**
                 * Optimised appear handoffs pass the WAAPI animation's
                 * startTime so the JS animation resumes in sync with it.
                 * The sync driver's clock starts at 0, so this startTime
                 * places the animation halfway through when it starts.
                 */
                startTime: -50,
                isHandoff: true,
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: resolve,
            })
        })

        expect(output).toEqual([50, 70, 90, 100])
    })

    test("Derives a startTime when none is provided", async () => {
        const output: number[] = []

        await new Promise<void>((resolve) => {
            new AsyncMotionValueAnimation({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                driver: syncDriver(20),
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: resolve,
            })
        })

        expect(output).toEqual([0, 20, 40, 60, 80, 100])
    })

    test("Starts a renderer's own animation when its element provides one", () => {
        const nativeAnimation = { stop: () => {} } as any
        const createAnimation = jest.fn(() => nativeAnimation)

        const animation = new AsyncMotionValueAnimation({
            keyframes: [0, 100],
            duration: 100,
            element: { createAnimation } as any,
        })

        expect(animation.animation).toBe(nativeAnimation)
        expect(createAnimation).toHaveBeenCalledTimes(1)
        expect((createAnimation.mock.calls[0] as any)[0].keyframes).toEqual([
            0, 100,
        ])
    })

    test("Runs in JS when the renderer's element declines", async () => {
        const output: number[] = []
        const createAnimation = jest.fn(() => undefined)

        await new Promise<void>((resolve) => {
            new AsyncMotionValueAnimation({
                keyframes: [0, 100],
                duration: 100,
                ease: "linear",
                driver: syncDriver(20),
                element: { createAnimation } as any,
                onUpdate: (v) => output.push(Math.round(v)),
                onComplete: resolve,
            })
        })

        expect(createAnimation).toHaveBeenCalledTimes(1)
        expect(output).toEqual([0, 20, 40, 60, 80, 100])
    })
})
