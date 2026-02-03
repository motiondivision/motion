import { frame, cancelFrame, frameData, FrameData } from "motion-dom"
import type { Driver } from "motion-dom"

/**
 * Animation driver for Remotion that bypasses requestAnimationFrame.
 * When set via MotionGlobalConfig.driver, animations only advance
 * when renderFrame() is called.
 */
export const remotionDriver: Driver = (update) => {
    const passTimestamp = ({ timestamp }: FrameData) => update(timestamp)

    return {
        start: (keepAlive = true) => frame.update(passTimestamp, keepAlive),
        stop: () => cancelFrame(passTimestamp),
        now: () => frameData.timestamp,
    }
}
