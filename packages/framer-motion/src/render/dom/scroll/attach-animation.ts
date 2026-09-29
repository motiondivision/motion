import { AnimationPlaybackControls, resize } from "motion-dom"
import { scrollInfo } from "./track"
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
     * - No target and no offset: ScrollTimeline
     * - Target with mappable offset: ViewTimeline with named range
     * - Otherwise: fall back to JS observe. A ScrollTimeline has no offset,
     *   so page offsets are applied by the JS timeline.
     */
    const native =
        canUseNativeTimeline(target) && (target ? !!range : !options.offset)
    const animations = new Map<Animation, PlaybackDirection>()
    const observed = new Set<AnimationPlaybackControls>()
    let stopObserving: VoidFunction | undefined
    let reverse = false

    /**
     * When an offset's second point comes first, its range is swapped and
     * the animation played backwards. The range is set after the direction,
     * as that's what realigns a running animation with its timeline. Chrome
     * skips that realignment when the range changes in the frame the
     * animation starts, leaving it offset for good, so it's replayed too.
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
        waapi.play()
    }

    const stops = [
        animation.attachTimeline({
            /**
             * Read only by WAAPI animations, so values driven from JS don't
             * create a native timeline they won't use.
             */
            get timeline() {
                return native ? getTimeline(options) : undefined
            },
            onAttach:
                range &&
                ((waapi) => {
                    const direction = waapi.effect!.getTiming().direction!
                    animations.set(waapi, direction)
                    apply(direction, waapi)
                }),
            /**
             * Values driven from JS all track the offset with scrollInfo,
             * which measures once per frame for all of them.
             */
            observe: (valueAnimation) => {
                valueAnimation.pause()
                observed.add(valueAnimation)

                stopObserving ||= scrollInfo((info) => {
                    observed.forEach((observedAnimation) => {
                        observedAnimation.time =
                            observedAnimation.iterationDuration *
                            info[axis].progress
                    })
                }, options)

                return () => observed.delete(valueAnimation)
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
            if (
                reverse !==
                (reverse = a * target![length] + b * container[length] < 0)
            ) {
                animations.forEach(apply)
            }
        }
        update()

        if (a * b < 0) {
            stops.push(resize(update), resize([target!, container], update))
        }
    }

    return () => {
        stops.forEach((stop) => stop())
        stopObserving?.()
    }
}
