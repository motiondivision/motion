import { motionValue, MotionValue, processFrame } from "motion-dom"
import { MotionGlobalConfig } from "motion-utils"
import { animate } from ".."

/**
 * Drive frames by hand, 16ms apart. On the real clock a stalled main
 * thread changes the result: a value reports no velocity once it's gone
 * 30ms without an update, and an animation whose first frame comes over
 * 40ms after it started begins from that frame instead. Both are wanted
 * in a browser, but they made this test fail on a slow CI machine.
 */
let now = 0
const frames = (count: number) => {
    for (let i = 0; i < count; i++) processFrame((now += 16))
}

const sample = (x: MotionValue<number>) => ({
    value: x.get(),
    velocity: x.getVelocity(),
})

const settle = (x: MotionValue<number>, target: number) => {
    for (let i = 0; i < 1000 && x.get() !== target; i++) frames(1)
}

beforeAll(() => {
    MotionGlobalConfig.useManualTiming = true
    processFrame(now)
})

afterAll(() => {
    MotionGlobalConfig.useManualTiming = false
})

describe("Interrupted springs inherit velocity", () => {
    test.each([
        { stiffness: 200, damping: 20 },
        { visualDuration: 0.5, bounce: 0.2 },
        { visualDuration: 0.5, bounce: 0 },
        { visualDuration: 0.5, bounce: -0.5 },
    ])("%o", (options) => {
        const transition = { type: "spring" as const, ...options }
        const x = motionValue(0)

        animate(x, 1000, transition)
        frames(6)
        const before = sample(x)
        expect(before.velocity).toBeGreaterThan(0)

        // Reverse the animation mid-flight
        animate(x, 0, transition)
        frames(1)
        const after = sample(x)

        /**
         * With its momentum, the value keeps moving towards the previous
         * target before the spring pulls it back.
         */
        expect(after.value).toBeGreaterThan(before.value)
        expect(after.velocity).toBeGreaterThan(0)

        settle(x, 0)
        expect(x.get()).toBe(0)
    })

    test("duration springs start from rest to keep their duration", () => {
        const transition = { type: "spring" as const, duration: 0.8 }
        const x = motionValue(0)

        animate(x, 1000, transition)
        frames(6)
        const before = x.get()

        animate(x, 0, transition)
        frames(1)
        expect(x.get()).toBeLessThan(before)
    })
})
