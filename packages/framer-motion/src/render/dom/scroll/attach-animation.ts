import { AnimationPlaybackControls, observeTimeline } from "motion-dom"
import { clamp, progress } from "motion-utils"
import { ScrollOffset, ScrollOptionsWithDefaults, ScrollRange } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"

/**
 * A ViewTimeline resolves plain percentages against its cover range: from
 * the target's start meeting the container's end, to its end meeting the
 * container's start.
 */
const coverOffset: ScrollOffset = [
    [0, 1],
    [1, 0],
]

const toFraction = (value: ScrollRange | undefined, fallback: number) =>
    typeof value === "string" ? parseFloat(value) / 100 : value ?? fallback

const toPercentage = (value: ScrollRange | undefined) =>
    typeof value === "number" ? value * 100 + "%" : value

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const { rangeStart, rangeEnd, target } = options
    const hasUserRange = rangeStart !== undefined || rangeEnd !== undefined

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
     * scroll range, or the target's cover range. A native ScrollTimeline or
     * ViewTimeline reports that already, and a JS one does with the
     * offset replaced.
     */
    const timeline = getTimeline(
        hasUserRange && !useNative
            ? { ...options, offset: target && coverOffset }
            : options
    )

    const start = toFraction(rangeStart, 0)
    const end = toFraction(rangeEnd, 1)

    return animation.attachTimeline({
        timeline: useNative ? timeline : undefined,
        ...(useNative &&
            (hasUserRange
                ? {
                      rangeStart: toPercentage(rangeStart),
                      rangeEnd: toPercentage(rangeEnd),
                  }
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
