import { cancelFrame, frame, FrameData, time } from "motion-dom"
import { secondsToMilliseconds } from "motion-utils"

export type DelayedFunction = (overshoot: number) => void

/**
 * Timeout defined in ms
 */
export function delay(callback: DelayedFunction, timeout: number) {
    const start = time.now()

    const checkElapsed = ({ timestamp }: FrameData) => {
        const elapsed = timestamp - start

        if (elapsed >= timeout) {
            cancelFrame(checkElapsed)
            callback(elapsed - timeout)
        }
    }

    frame.setup(checkElapsed, true)

    return () => cancelFrame(checkElapsed)
}

export function delayInSeconds(callback: DelayedFunction, timeout: number) {
    return delay(callback, secondsToMilliseconds(timeout))
}
