import { AnimationPlaybackControls, observeTimeline } from "motion-dom"
import { scrollInfo } from "./track"
import { ScrollOptionsWithDefaults } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"
import { resolveRangeFraction, resolveRangeString } from "./utils/range"

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const hasUserRange =
        options.rangeStart !== undefined || options.rangeEnd !== undefined

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
              rangeStart: resolveRangeString(options.rangeStart),
              rangeEnd: resolveRangeString(options.rangeEnd),
              fill: "auto",
          }
        : range && useNative
        ? { rangeStart: range.rangeStart, rangeEnd: range.rangeEnd }
        : undefined

    const rangeStartFraction = resolveRangeFraction(options.rangeStart, 0)
    const rangeEndFraction = resolveRangeFraction(options.rangeEnd, 1)
    const rangeSpan = rangeEndFraction - rangeStartFraction

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
                return scrollInfo((info) => {
                    const axis = info[options.axis]
                    const progress = axis.scrollLength
                        ? axis.current / axis.scrollLength
                        : 0

                    if (
                        progress < rangeStartFraction ||
                        progress > rangeEndFraction
                    ) {
                        valueAnimation.setActive?.(false)
                        return
                    }

                    valueAnimation.setActive?.(true)
                    valueAnimation.time =
                        valueAnimation.iterationDuration *
                        (rangeSpan > 0
                            ? (progress - rangeStartFraction) / rangeSpan
                            : 0)
                }, options)
            }

            return observeTimeline((progress) => {
                valueAnimation.time =
                    valueAnimation.iterationDuration * progress
            }, timeline!)
        },
    })
}
