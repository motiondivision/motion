import {
    AnimationPlaybackControls,
    observeTimeline,
    ProgressTimeline,
    resize,
} from "motion-dom"
import { ScrollOptionsWithDefaults } from "./types"
import { canUseNativeTimeline } from "./utils/can-use-native-timeline"
import { getTimeline } from "./utils/get-timeline"
import { offsetToViewTimelineRange } from "./utils/offset-to-range"

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const { target, container, axis } = options
    const timeline = getTimeline(options)

    const range = target ? offsetToViewTimelineRange(options.offset) : undefined

    /**
     * Use native timeline when:
     * - No target: ScrollTimeline (existing behaviour)
     * - Target with mappable offset: ViewTimeline with named range
     * - Target with unmappable offset: fall back to JS observe
     */
    const useNative =
        canUseNativeTimeline(target, container) && (!target || !!range)

    /**
     * Ranges other than cover are set on each WAAPI animation, including a
     * hidden one that JS-driven values read progress from, because a
     * ViewTimeline's currentTime is always its cover progress.
     */
    const ranged = useNative && range && !range.cover ? range : undefined
    const animations = new Map<Animation, PlaybackDirection>()
    const cleanup: VoidFunction[] = []
    let forward = true
    let rangeTimeline: ProgressTimeline | undefined

    const apply = (direction: PlaybackDirection, waapi: Animation) => {
        const [first, second] = ranged!.points
        Object.assign(waapi, {
            rangeStart: forward ? first : second,
            rangeEnd: forward ? second : first,
        })
        waapi.effect!.updateTiming({
            direction: forward
                ? direction
                : direction === "alternate"
                ? "alternate-reverse"
                : "reverse",
        })
    }

    const onAttach = (waapi: Animation) => {
        animations.set(waapi, waapi.effect!.getTiming().direction!)
        apply(animations.get(waapi)!, waapi)
        return () => animations.delete(waapi)
    }

    if (ranged) {
        const { a, b } = ranged
        const length = axis === "y" ? "clientHeight" : "clientWidth"

        /**
         * Offsets like All run forwards only when the target is longer than
         * the container, so their direction is remeasured on resize.
         */
        const update = () => {
            forward =
                a * b < 0
                    ? a * target![length] + b * container[length] >= 0
                    : a + b > 0
            animations.forEach(apply)
        }
        update()

        if (a * b < 0) {
            cleanup.push(
                resize(update),
                resize(target!, update),
                resize(container, update)
            )
        }
    }

    const detach = animation.attachTimeline({
        timeline: useNative ? timeline : undefined,
        onAttach: ranged && onAttach,
        observe: (valueAnimation) => {
            valueAnimation.pause()

            if (ranged && !rangeTimeline) {
                const hidden = document
                    .createElement("div")
                    .animate(null, { timeline, fill: "both" } as any)
                cleanup.push(onAttach(hidden), () => hidden.cancel())
                rangeTimeline = {
                    get currentTime() {
                        return {
                            value:
                                hidden.effect!.getComputedTiming().progress! *
                                100,
                        }
                    },
                }
            }

            return observeTimeline((progress) => {
                valueAnimation.time =
                    valueAnimation.iterationDuration * progress
            }, rangeTimeline || timeline)
        },
    })

    return () => {
        detach()
        cleanup.forEach((stop) => stop())
    }
}
