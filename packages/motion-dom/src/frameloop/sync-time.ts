import { MotionGlobalConfig } from "motion-utils"
import { frameData } from "./frame"

let now: number | undefined

function clearTime() {
    now = undefined
}

/**
 * An eventloop-synchronous alternative to performance.now().
 *
 * Ensures that time measurements remain consistent within a synchronous context.
 * Usually calling performance.now() twice within the same synchronous context
 * will return different values which isn't useful for animations when we're usually
 * trying to sync animations to the same frame.
 */
export const time = {
    now: (): number => {
        if (now === undefined) {
            time.set(
                frameData.isProcessing || MotionGlobalConfig.useManualTiming
                    ? frameData.timestamp
                    : performance.now()
            )
        }

        return now!
    },
    set: (newTime: number) => {
        now = newTime
        queueMicrotask(clearTime)
    },
}
