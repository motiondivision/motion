import { AnimationPlaybackControls, AnimationScope } from "motion-dom"
import { spring } from "../generators/spring"
import { createAnimationsFromSequence } from "../sequence/create"
import { AnimationSequence, SequenceOptions } from "../sequence/types"
import { animateSubject } from "./subject"

export function animateSequence(
    sequence: AnimationSequence,
    options?: SequenceOptions,
    scope?: AnimationScope
) {
    const animations: AnimationPlaybackControls[] = []

    const animationDefinitions = createAnimationsFromSequence(
        sequence,
        options,
        scope,
        { spring }
    )

    animationDefinitions.forEach(({ keyframes, transition }, subject) => {
        animations.push(...animateSubject(subject, keyframes, transition))
    })

    return animations
}
