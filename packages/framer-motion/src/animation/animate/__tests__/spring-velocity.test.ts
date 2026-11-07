import { frame, motionValue } from "motion-dom"
import { animate } from ".."

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

async function frames(count: number) {
    for (let i = 0; i < count; i++) await nextFrame()
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
        await frames(6)

        const before = x.get()
        const velocity = x.getVelocity()
        expect(velocity).toBeGreaterThan(0)

        // Reverse the animation mid-flight
        const animation = animate(x, 0, transition)
        await frames(1)

        /**
         * With its momentum, the value keeps moving towards the previous
         * target before the spring pulls it back.
         */
        expect(x.get()).toBeGreaterThan(before)
        expect(x.getVelocity()).toBeGreaterThan(0)

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
