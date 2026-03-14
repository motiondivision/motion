import { AnimationPlaybackControls, observeTimeline } from "motion-dom"
import { ScrollOptionsWithDefaults } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const timeline = getTimeline(options)

    const hasUserRange = options.rangeStart || options.rangeEnd

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

    return animation.attachTimeline({
        timeline: useNative ? timeline : undefined,
        ...(hasUserRange
            ? {
                  rangeStart: options.rangeStart,
                  rangeEnd: options.rangeEnd,
                  fill: "auto",
              }
            : range &&
              useNative && {
                  rangeStart: range.rangeStart,
                  rangeEnd: range.rangeEnd,
              }),
        observe: (valueAnimation) => {
            valueAnimation.pause()

            return observeTimeline((progress) => {
                valueAnimation.time =
                    valueAnimation.iterationDuration * progress
            }, timeline)
        },
    })
}
