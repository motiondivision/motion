import {
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    SequenceCallbackAnimation,
    spring,
} from "motion-dom"
import { secondsToMilliseconds } from "motion-utils"
import { createAnimationsFromSequence } from "../sequence/create"
import { AnimationSequence, SequenceOptions } from "../sequence/types"
import { animateSubject } from "./subject"

export function animateSequence(
    sequence: AnimationSequence,
    options?: SequenceOptions,
    scope?: AnimationScope
) {
    const animations: AnimationPlaybackControlsWithThen[] = []

    const { animationDefinitions, callbacks, totalDuration } =
        createAnimationsFromSequence(sequence, options, scope, { spring })

    animationDefinitions.forEach(({ keyframes, transition }, subject) => {
        animations.push(...animateSubject(subject, keyframes, transition))
    })

    // Add callback animation if there are any callbacks
    if (callbacks.length > 0) {
        const callbackAnimation = new SequenceCallbackAnimation(
            callbacks,
            secondsToMilliseconds(totalDuration)
        )
        animations.push(
            callbackAnimation as unknown as AnimationPlaybackControlsWithThen
        )
    }

    return animations
}
