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
})
