import {
    animateSingleValue,
    AnimationPlaybackControls,
    GroupAnimationWithThen,
} from "motion-dom"
import { createAnimationsFromSequence } from "../../sequence/create"
import {
    AnimationSequence,
    ResolvedSequenceCallback,
    SequenceOptions,
} from "../../sequence/types"
import { animateElements } from "./animate-elements"

/**
 * Creates an onUpdate callback that fires sequence callbacks when time crosses their thresholds.
 */
function createCallbackUpdater(
    callbacks: ResolvedSequenceCallback[],
    totalDuration: number
) {
    let prevProgress = 0

    return (progress: number) => {
        const currentTime = progress * totalDuration

        for (const callback of callbacks) {
            const prevTime = prevProgress * totalDuration

            if (prevTime < callback.time && currentTime >= callback.time) {
                callback.forward?.()
            } else if (prevTime >= callback.time && currentTime < callback.time) {
                callback.backward?.()
            }
        }

        prevProgress = progress
    }
}

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

    // Add a 0→1 animation with onUpdate to track callbacks
    if (callbacks.length > 0) {
        const callbackAnimation = animateSingleValue(0, 1, {
            duration: totalDuration,
            ease: "linear",
            onUpdate: createCallbackUpdater(callbacks, totalDuration),
        })
        animations.push(callbackAnimation)
    }

    return new GroupAnimationWithThen(animations)
}
