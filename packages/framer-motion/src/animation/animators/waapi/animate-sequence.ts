import { GroupAnimationWithThen } from "motion-dom"
import { createAnimationsFromSequence } from "../../sequence/create"
import { AnimationSequence, SequenceOptions } from "../../sequence/types"
import {
    addAnimationDefinitions,
    AnimationDefinition,
    startAnimationDefinitions,
} from "./animate-elements"

export function animateSequence(
    definition: AnimationSequence,
    options?: SequenceOptions
) {
    /**
     * Build every element's animations before starting any, so all
     * elements' keyframes are read in one pass rather than one read
     * after each element's write.
     */
    const animationDefinitions: AnimationDefinition[] = []

    createAnimationsFromSequence(definition, options).forEach(
        ({ keyframes, transition }, element: Element) => {
            addAnimationDefinitions(
                animationDefinitions,
                element,
                keyframes,
                transition
            )
        }
    )

    return new GroupAnimationWithThen(
        startAnimationDefinitions(animationDefinitions)
    )
}
