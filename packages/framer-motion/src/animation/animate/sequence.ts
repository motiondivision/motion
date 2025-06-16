import {
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    spring,
} from "motion-dom"
import { createAnimationsFromSequence } from "../sequence/create"
import { AnimationSequence, SequenceOptions } from "../sequence/types"
import { animateSubject } from "./subject"

export function animateSequence(
    sequence: AnimationSequence,
    options?: SequenceOptions,
    scope?: AnimationScope
) {
    const animations: AnimationPlaybackControlsWithThen[] = []

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
