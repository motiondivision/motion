import { ProgressTimeline } from "../animation/types"
import { cancelFrame, frame } from "../frameloop"

type Update = (progress: number) => void

/**
 * @deprecated Kept because framer-motion 13.0–13.4 import it from
 * motion-dom with a ^ range. Removed in v14.
 */
export function observeTimeline(update: Update, timeline: ProgressTimeline) {
    let prevProgress: number

    const onFrame = () => {
        const { currentTime } = timeline
        const percentage = currentTime === null ? 0 : currentTime.value
        const progress = percentage / 100

        if (prevProgress !== progress) {
            update(progress)
        }

        prevProgress = progress
    }

    frame.preUpdate(onFrame, true)

    return () => cancelFrame(onFrame)
}
