import { MotionGlobalConfig } from "motion-utils"
import { followValue } from "../follow-value"
import { motionValue } from "../index"
import { attachSpring, springValue } from "../spring-value"
import { spring } from "../../animation/generators/spring"
import { frame, frameSteps, frameData } from "../../frameloop"
import { time } from "../../frameloop/sync-time"

/**
 * Process a single frame at the given timestamp, running all frame loop steps.
 */
function processFrame(timestamp: number) {
    const prevTimestamp = frameData.timestamp
    frameData.timestamp = timestamp
    frameData.delta = timestamp - (prevTimestamp || 0) || 1000 / 60
    frameData.isProcessing = true
    time.set(timestamp)
    frameSteps.setup.process(frameData)
    frameSteps.read.process(frameData)
    frameSteps.resolveKeyframes.process(frameData)
    frameSteps.preUpdate.process(frameData)
    frameSteps.update.process(frameData)
    frameSteps.preRender.process(frameData)
    frameSteps.render.process(frameData)
    frameSteps.postRender.process(frameData)
    frameData.isProcessing = false
}

describe("Spring follow at different frame rates (issues #3265, #3407)", () => {
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
        frameData.timestamp = 0
        time.set(0)
    })

    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
    })

    test("following springs share one persistent frame callback", () => {
        const schedule = jest.spyOn(frame, "update")
        const values = Array.from({ length: 3 }, () => springValue<number>(0))
        values.forEach((value) => value.set(100))
        processFrame(0)
        expect(
            schedule.mock.calls.filter(([, keepAlive]) => keepAlive)
        ).toHaveLength(1)
        processFrame(16)
        expect(values.every((value) => value.get() > 0)).toBe(true)
        values.forEach((value) => value.destroy())
        schedule.mockRestore()
    })

    test("following springs set several times in one frame retarget, and notify animationStart, once", () => {
        const schedule = jest.spyOn(frame, "postRender")
        const values = Array.from({ length: 3 }, () => springValue<number>(0))
        const starts = jest.fn()
        values.forEach((value) => {
            value.on("animationStart", starts)
            value.set(100)
            value.set(200)
        })
        // Retargeting happens in the shared tick, not a callback per value
        expect(schedule).not.toHaveBeenCalled()
        processFrame(0)
        expect(starts).toHaveBeenCalledTimes(3)
        processFrame(16)
        expect(values.every((value) => value.get() > 0)).toBe(true)

        // Retargeting an in-flight spring still notifies animationStart
        values[0].set(300)
        processFrame(32)
        expect(starts).toHaveBeenCalledTimes(4)

        values.forEach((value) => value.destroy())
        schedule.mockRestore()
    })

    test("repeating followers announce animationStart after the animation is assigned", () => {
        const value = followValue<number>(0, {
            type: "tween",
            duration: 100,
            repeat: 1,
        })
        let animatingAtStart: boolean | undefined
        value.on("animationStart", () => {
            animatingAtStart = value.isAnimating()
        })

        value.set(100)
        expect(animatingAtStart).toBe(true)
        value.destroy()
    })

    test("stopping a batched spring leaves the others running and the batch can restart", () => {
        const a = springValue<number>(0)
        const b = springValue<number>(0)
        a.set(100)
        b.set(100)
        processFrame(0)
        processFrame(16)
        const stopped = a.get()
        a.stop()
        processFrame(32)
        expect(a.get()).toBe(stopped)
        expect(b.get()).toBeGreaterThan(stopped)
        b.stop()
        a.set(200)
        processFrame(48)
        processFrame(64)
        expect(a.get()).toBeGreaterThan(stopped)
        a.destroy()
        b.destroy()
    })

    test("completion of a previous spring cannot clear a newer animation", async () => {
        const value = springValue<number>(0)
        value.set(100)
        processFrame(0)
        processFrame(5000)
        value.set(200)
        processFrame(5016)
        await Promise.resolve()
        expect(value.isAnimating()).toBe(true)
        processFrame(5032)
        expect(value.get()).toBeGreaterThan(100)
        value.destroy()
    })

    test("retargets without replacing the animation and completes once at the latest target", async () => {
        const value = springValue<number>(0)
        const complete = jest.fn()
        value.on("animationComplete", complete)

        value.set(100)
        processFrame(0)
        const { animation } = value
        expect(animation).toBeDefined()
        for (let t = 16; t <= 160; t += 16) {
            value.set(t)
            processFrame(t)
        }
        expect(value.animation).toBe(animation)
        expect(value.isAnimating()).toBe(true)

        for (let t = 176; t <= 5000; t += 16) processFrame(t)
        await Promise.resolve()
        expect(value.get()).toBe(160)
        expect(value.isAnimating()).toBe(false)
        expect(complete).toHaveBeenCalledTimes(1)
        value.destroy()
    })

    test.each([10, 20, 30])(
        "retargeting preserves analytical position and velocity with damping %s",
        (damping) => {
            const options = {
                stiffness: 100,
                damping,
                restDelta: 0.001,
                restSpeed: 0.01,
            }
            const value = springValue<number>(0, options)
            let generator = spring({ ...options, keyframes: [0, 100] })
            value.set(100)
            processFrame(0)

            for (let t = 16; t <= 320; t += 16) {
                const target = Math.sin(t / 100) * 100
                const expected = generator.next(16).value
                const velocity = generator.velocity!(16)
                value.set(target)
                processFrame(t)
                expect(value.get()).toBeCloseTo(expected, 8)
                generator = spring({
                    ...options,
                    keyframes: [expected, target],
                    velocity,
                })
            }
            value.destroy()
        }
    )

    test("spring position should be consistent at 240hz vs 60hz when following a moving target", () => {
        /**
         * The bug: at 240hz, the spring animation restarts every ~4ms with
         * an inaccurate velocity estimate (finite difference), causing the
         * spring to systematically lose energy and fall behind compared to
         * 60hz where restarts happen every ~16ms.
         */
        const stiffness = 100
        const damping = 10
        const mass = 1
        const springOpts = { stiffness, damping, mass }

        // Test with a linearly moving target over 100ms
        const totalTime = 100
        const targetVelocity = 500 // px/s => target moves 50px in 100ms

        function simulateSpring(fps: number): number {
            const source = motionValue(0)
            const output = motionValue(0)
            const cleanup = attachSpring(output, source, springOpts)

            const interval = 1000 / fps
            let t = 0

            // Initial frame to set up the spring
            source.set(0)
            processFrame(t)

            const numFrames = Math.ceil(totalTime / interval)
            for (let i = 1; i <= numFrames; i++) {
                t = i * interval
                // Move the target (like mouse movement)
                source.set(targetVelocity * (t / 1000))
                processFrame(t)
            }

            const result = output.get()
            cleanup()
            return result
        }

        const pos60 = simulateSpring(60)
        const pos240 = simulateSpring(240)

        // Both frame rates should produce similar spring positions.
        // Before the fix, 240hz was ~34% behind 60hz.
        // After the fix, they should be within 10% of each other.
        const ratio = pos240 / pos60
        expect(ratio).toBeGreaterThan(0.9)
        expect(ratio).toBeLessThan(1.1)
    })
})
