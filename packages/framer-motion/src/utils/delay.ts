import { secondsToMilliseconds } from "motion-utils"
import { cancelFrame, frame } from "../frameloop"
import { time } from "../frameloop/sync-time"
import { FrameData } from "../frameloop/types"

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

    frame.read(checkElapsed, true)

    return () => cancelFrame(checkElapsed)
}

export function delayInSeconds(callback: DelayedFunction, timeout: number) {
    return delay(callback, secondsToMilliseconds(timeout))
}
