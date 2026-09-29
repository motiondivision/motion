import { AnimationPlaybackControls, observeTimeline } from "motion-dom"
import { clamp, progress } from "motion-utils"
import { ScrollOptionsWithDefaults } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const { rangeStart, rangeEnd, target } = options
    const hasUserRange = (rangeStart ?? rangeEnd) !== undefined

    const range = target ? offsetToViewTimelineRange(options.offset) : undefined

    /**
     * Use native timeline when:
     * - No target: ScrollTimeline (existing behaviour)
     * - Target with mappable offset: ViewTimeline with named range
     * - Target with unmappable offset: fall back to JS observe
     */
    const useNative = target
        ? canUseNativeTimeline(target) && !!range
        : canUseNativeTimeline()

    /**
     * A range is progress through the whole timeline: the full scroll range,
     * or for a target its "cover" range, from when the target starts to enter
     * the container until it has completely left. Native ScrollTimeline and
     * ViewTimeline already measure progress that way, but the JS fallback
     * follows `offset`. So when a range is set without native timelines,
     * replace `offset` with the cover range for a target (the target's start
     * meeting the container's end, to its end meeting the container's start),
     * or with no offset for the page.
     */
    const timeline = getTimeline(
        hasUserRange && !useNative
            ? {
                  ...options,
                  offset: target && [
                      [0, 1],
                      [1, 0],
                  ],
              }
            : options
    )

    const start = rangeStart ?? 0
    const end = rangeEnd ?? 1

    return animation.attachTimeline({
        timeline: useNative ? timeline : undefined,
        ...(useNative &&
            (hasUserRange
                ? { rangeStart: start * 100 + "%", rangeEnd: end * 100 + "%" }
                : range)),
        observe: (valueAnimation) => {
            valueAnimation.pause()

            /**
             * Outside the range, hold the first or last keyframe, as native
             * animations do with their fill of "both".
             */
            return observeTimeline((timelineProgress) => {
                valueAnimation.time =
                    valueAnimation.iterationDuration *
                    clamp(0, 1, progress(start, end, timelineProgress))
            }, timeline)
        },
    })
}
