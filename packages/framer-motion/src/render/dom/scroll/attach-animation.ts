import { AnimationPlaybackControls, observeTimeline } from "motion-dom"
import { clamp, progress } from "motion-utils"
import { ScrollOptionsWithDefaults, ScrollRange } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"

const toPercentage = (value: ScrollRange) =>
    typeof value === "string" ? parseFloat(value) : value * 100

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
     * A user range is resolved against the timeline's full progress: the
     * scroll range, or the target's cover range, from the target's start
     * meeting the container's end to its end meeting the container's start.
     * A native ScrollTimeline or ViewTimeline reports that already, and a JS
     * one does with the offset replaced.
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

    const start = toPercentage(rangeStart ?? 0)
    const end = toPercentage(rangeEnd ?? 1)

    return animation.attachTimeline({
        timeline: useNative ? timeline : undefined,
        ...(useNative &&
            (hasUserRange
                ? { rangeStart: start + "%", rangeEnd: end + "%" }
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
                    clamp(0, 1, progress(start, end, timelineProgress * 100))
            }, timeline)
        },
    })
}
