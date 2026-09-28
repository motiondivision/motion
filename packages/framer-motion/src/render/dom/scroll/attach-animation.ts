import { AnimationPlaybackControls, observeTimeline, resize } from "motion-dom"
import { ScrollOptionsWithDefaults } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const { target, container, axis } = options
    const range = target && offsetToViewTimelineRange(options.offset)

    /**
     * Use native timeline when:
     * - No target: ScrollTimeline (existing behaviour)
     * - Target with mappable offset: ViewTimeline with named range
     * - Target with unmappable offset: fall back to JS observe
     */
    const native = canUseNativeTimeline(target) && (!target || !!range)
    const timeline = getTimeline(options, native)
    const animations = new Map<Animation, PlaybackDirection>()
    let reverse = false

    /**
     * When an offset's second point comes first, its range is swapped and
     * the animation played backwards. The range is set after the direction,
     * as that's what realigns a running animation with its timeline.
     */
    const apply = (direction: PlaybackDirection, waapi: Animation) => {
        const [start, end] = range!.points
        waapi.effect!.updateTiming({
            direction: reverse
                ? direction === "normal"
                    ? "reverse"
                    : "alternate-reverse"
                : direction,
        })
        Object.assign(waapi, {
            rangeStart: reverse ? end : start,
            rangeEnd: reverse ? start : end,
        })
    }

    const stops = [
        animation.attachTimeline({
            timeline: native ? timeline : undefined,
            onAttach:
                range &&
                ((waapi) => {
                    const direction = waapi.effect!.getTiming().direction!
                    animations.set(waapi, direction)
                    apply(direction, waapi)
                }),
            observe: (valueAnimation) => {
                valueAnimation.pause()

                return observeTimeline(
                    (progress) => {
                        valueAnimation.time =
                            valueAnimation.iterationDuration * progress
                    },
                    /**
                     * A ViewTimeline's progress is its cover range, so values
                     * driven from JS on other ranges track the offset in JS.
                     */
                    range && !range.cover
                        ? getTimeline(options, false)
                        : timeline
                )
            },
        }),
    ]

    if (native && range) {
        const { a, b } = range
        const length = axis === "y" ? "clientHeight" : "clientWidth"

        /**
         * Offsets like All only run forwards when the target is longer than
         * the container, so their direction is remeasured on resize.
         */
        const update = () => {
            reverse = a * target![length] + b * container[length] < 0
            animations.forEach(apply)
        }
        update()

        if (a * b < 0) {
            stops.push(resize(update), resize([target!, container], update))
        }
    }

    return () => stops.forEach((stop) => stop())
}
