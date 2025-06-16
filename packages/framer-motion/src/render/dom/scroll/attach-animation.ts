import { AnimationPlaybackControls, observeTimeline } from "motion-dom"
import { ScrollOptionsWithDefaults } from "./types"
import { getTimeline } from "./utils/get-timeline"

export function attachToAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptionsWithDefaults
) {
    const timeline = getTimeline(options)

    return animation.attachTimeline({
        timeline: options.target ? undefined : timeline,
        observe: (valueAnimation) => {
            valueAnimation.pause()

            return observeTimeline((progress) => {
                valueAnimation.time = valueAnimation.duration * progress
            }, timeline)
        },
    })
}
