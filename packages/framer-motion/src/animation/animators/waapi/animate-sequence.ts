import { AnimationPlaybackControls, GroupAnimationWithThen } from "motion-dom"
import { createAnimationsFromSequence } from "../../sequence/create"
import { AnimationSequence, SequenceOptions } from "../../sequence/types"
import { flattenSequence } from "../../sequence/utils/flatten"
import { animateElements } from "./animate-elements"

export function animateSequence(
    definition: AnimationSequence,
    options?: SequenceOptions
) {
    const animations: AnimationPlaybackControls[] = []

    definition = flattenSequence(definition)

    createAnimationsFromSequence(definition, options).forEach(
        ({ keyframes, transition }, element: Element) => {
            animations.push(...animateElements(element, keyframes, transition))
        }
    )

    return new GroupAnimationWithThen(animations)
}
