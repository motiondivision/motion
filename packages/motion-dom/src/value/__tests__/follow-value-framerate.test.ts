import { MotionGlobalConfig } from "motion-utils"
import { motionValue } from "../index"
import { attachSpring } from "../spring-value"
import { frameSteps, frameData } from "../../frameloop"
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

describe("Spring follow at different frame rates (issue #3265)", () => {
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
        frameData.timestamp = 0
        time.set(0)
    })

    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
    })

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
