import { frame, motionValue, MotionValue } from "motion-dom"
import { animate } from ".."

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

async function frames(count: number) {
    for (let i = 0; i < count; i++) await nextFrame()
}

/**
 * Read the value and its velocity inside the frame. A motion value reports
 * no velocity once it's gone 30ms without an update, so a read made after
 * the frame fails whenever the frame takes that long, as it can on CI.
 */
async function sample(x: MotionValue<number>, afterFrames: number) {
    await frames(afterFrames - 1)
    return new Promise<{ value: number; velocity: number }>((resolve) => {
        frame.postRender(() =>
            resolve({ value: x.get(), velocity: x.getVelocity() })
        )
    })
}

describe("Interrupted springs inherit velocity", () => {
    test.each([
        { stiffness: 200, damping: 20 },
        { visualDuration: 0.5, bounce: 0.2 },
        { visualDuration: 0.5, bounce: 0 },
        { visualDuration: 0.5, bounce: -0.5 },
    ])("%o", async (options) => {
        const transition = { type: "spring" as const, ...options }
        const x = motionValue(0)

        animate(x, 1000, transition)
        const before = await sample(x, 6)
        expect(before.velocity).toBeGreaterThan(0)

        // Reverse the animation mid-flight
        const animation = animate(x, 0, transition)
        const after = await sample(x, 1)

        /**
         * With its momentum, the value keeps moving towards the previous
         * target before the spring pulls it back.
         */
        expect(after.value).toBeGreaterThan(before.value)
        expect(after.velocity).toBeGreaterThan(0)

        await animation
        expect(x.get()).toBe(0)
    })

    test("duration springs start from rest to keep their duration", async () => {
        const transition = { type: "spring" as const, duration: 0.8 }
        const x = motionValue(0)

        animate(x, 1000, transition)
        await frames(6)
        const before = x.get()

        animate(x, 0, transition)
        await frames(1)
        expect(x.get()).toBeLessThan(before)
    })
})
