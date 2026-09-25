import { observeTimeline } from "motion-dom"
import { scrollInfo } from "./track"
import { OnScroll, OnScrollWithInfo, ScrollOptionsWithDefaults } from "./types"
import { getTimeline } from "./utils/get-timeline"
import { isElementTracking } from "./utils/is-element-tracking"

/**
 * If the onScroll function has two arguments, it's expecting
 * more specific information about the scroll from scrollInfo.
 */
function isOnScrollWithInfo(onScroll: OnScroll): onScroll is OnScrollWithInfo {
    return onScroll.length === 2
}

export function attachToFunction(
    onScroll: OnScroll,
    options: ScrollOptionsWithDefaults
) {
    if (isOnScrollWithInfo(onScroll) || isElementTracking(options)) {
        let prevProgress: number | undefined

        /**
         * Callbacks that only declare progress are notified when it changes,
         * matching observeTimeline. Callbacks that declare info are notified
         * every frame, as velocity and measurements can change independently.
         */
        return scrollInfo((info) => {
            const progress = info[options.axis].progress

            if (onScroll.length > 1 || progress !== prevProgress) {
                onScroll(progress, info)
                prevProgress = progress
            }
        }, options)
    } else {
        return observeTimeline(onScroll, getTimeline(options))
    }
}
