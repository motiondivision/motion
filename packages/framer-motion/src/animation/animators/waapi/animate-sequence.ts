import { AnimationPlaybackControls, GroupPlaybackControls } from "motion-dom"
import { createAnimationsFromSequence } from "../../sequence/create"
import { AnimationSequence, SequenceOptions } from "../../sequence/types"
import { animateElements } from "./animate-elements"

export function animateSequence(
    definition: AnimationSequence,
    options?: SequenceOptions
) {
    const animations: AnimationPlaybackControls[] = []

    createAnimationsFromSequence(definition, options).forEach(
        ({ keyframes, transition }, element: Element) => {
            animations.push(...animateElements(element, keyframes, transition))
        }
    )

    return new GroupPlaybackControls(animations)
}
