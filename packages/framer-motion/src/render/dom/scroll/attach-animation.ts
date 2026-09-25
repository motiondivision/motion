import { AnimationPlaybackControls, observeTimeline } from "motion-dom"
import { scrollInfo } from "./track"
import { ScrollOffset, ScrollOptionsWithDefaults } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"
import { resolveRangeFraction, resolveRangeString } from "./utils/range"

/**
 * A ViewTimeline resolves plain percentages against its cover range: from
 * the target's start meeting the container's end, to its end meeting the
 * container's start.
 */
const coverOffset: ScrollOffset = [
    [0, 1],
    [1, 0],
]

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const { rangeStart, rangeEnd } = options
    const hasUserRange = rangeStart !== undefined || rangeEnd !== undefined

    const range = options.target
        ? offsetToViewTimelineRange(options.offset)
        : undefined

    /**
     * Use native timeline when:
     * - No target: ScrollTimeline (existing behaviour)
     * - Target with mappable offset: ViewTimeline with named range
     * - Target with unmappable offset: fall back to JS observe
     */
    const useNative = options.target
        ? canUseNativeTimeline(options.target) && !!range
        : canUseNativeTimeline()

    /**
     * The JS observe fallback drives range deactivation itself (below), so it
     * doesn't need a timeline. Avoid creating an unused scroll tracker for it.
     */
    const timeline =
        useNative || !hasUserRange ? getTimeline(options) : undefined

    /**
     * User-provided rangeStart/rangeEnd take precedence over the offset-derived
     * ViewTimeline range. Forward them to the native animation as a WAAPI range
     * with `fill: "auto"`, so the effect is removed outside the range (matching
     * native `animation-range`, allowing `:hover` and other styles to apply).
     */
    const rangeTiming = hasUserRange
        ? {
              rangeStart: resolveRangeString(rangeStart),
              rangeEnd: resolveRangeString(rangeEnd),
              fill: "auto" as const,
          }
        : range && useNative
        ? { rangeStart: range.rangeStart, rangeEnd: range.rangeEnd }
        : undefined

    return animation.attachTimeline({
        timeline: useNative ? timeline : undefined,
        ...rangeTiming,
        observe: (valueAnimation) => {
            valueAnimation.pause()

            /**
             * When the user has set rangeStart/rangeEnd and we've fallen back to
             * JS observation (no native ScrollTimeline, or a JS animation), map
             * the active window ourselves and deactivate the animation outside
             * it so the underlying styles can take over.
             */
            if (hasUserRange) {
                const start = resolveRangeFraction(rangeStart, 0)
                const end = resolveRangeFraction(rangeEnd, 1)

                return scrollInfo(
                    (info) => {
                        const axis = info[options.axis]
                        const [from, to] = axis.offset
                        const progress =
                            to !== from
                                ? (axis.current - from) / (to - from)
                                : 0
                        const isActive = progress >= start && progress <= end

                        valueAnimation.setActive?.(isActive)

                        if (isActive) {
                            valueAnimation.time =
                                valueAnimation.iterationDuration *
                                (end > start
                                    ? (progress - start) / (end - start)
                                    : 0)
                        }
                    },
                    /**
                     * Progress is read from the resolved offsets, [0,
                     * scrollLength] without a target, rather than `progress`,
                     * which is clamped, so it can fall outside 0–1.
                     */
                    { ...options, offset: options.target && coverOffset }
                )
            }

            return observeTimeline((progress) => {
                valueAnimation.time =
                    valueAnimation.iterationDuration * progress
            }, timeline!)
        },
    })
}
