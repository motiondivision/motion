import {
    AnimationPlaybackControls,
    GroupAnimationWithThen,
    SequenceCallbackAnimation,
} from "motion-dom"
import { secondsToMilliseconds } from "motion-utils"
import { createAnimationsFromSequence } from "../../sequence/create"
import { AnimationSequence, SequenceOptions } from "../../sequence/types"
import { animateElements } from "./animate-elements"

export function animateSequence(
    definition: AnimationSequence,
    options?: SequenceOptions
) {
    const animations: AnimationPlaybackControls[] = []

    const { animationDefinitions, callbacks, totalDuration } =
        createAnimationsFromSequence(definition, options)

    animationDefinitions.forEach(
        ({ keyframes, transition }, element: Element) => {
            animations.push(...animateElements(element, keyframes, transition))
        }
    )

    // Add callback animation if there are any callbacks
    if (callbacks.length > 0) {
        const callbackAnimation = new SequenceCallbackAnimation(
            callbacks,
            secondsToMilliseconds(totalDuration)
        )
        animations.push(callbackAnimation as unknown as AnimationPlaybackControls)
    }

    return new GroupAnimationWithThen(animations)
}
