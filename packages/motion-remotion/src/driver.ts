import { frame, cancelFrame, frameData, FrameData } from "motion-dom"
import type { Driver } from "motion-dom"

/**
 * A driver for Remotion that uses the frame loop but doesn't auto-schedule rAF.
 * Instead, it's driven by manual renderFrame() calls.
 *
 * When this driver is set globally via MotionGlobalConfig.driver:
 * 1. Animations register their tick functions on the frame loop
 * 2. The batcher skips rAF scheduling (because a custom driver is set)
 * 3. Only renderFrame() calls will advance animations
 *
 * This ensures animations only progress when Remotion renders a frame.
 */
export const remotionDriver: Driver = (update) => {
    const passTimestamp = ({ timestamp }: FrameData) => update(timestamp)

    return {
        /**
         * Register the animation's tick function on the frame loop.
         * The batcher will skip rAF scheduling since a custom driver is set.
         */
        start: (keepAlive = true) => frame.update(passTimestamp, keepAlive),

        /**
         * Unregister from the frame loop.
         */
        stop: () => cancelFrame(passTimestamp),

        /**
         * Returns the current frame timestamp from the global frameData.
         * This is set by renderFrame() calls.
         */
        now: () => frameData.timestamp,
    }
}
