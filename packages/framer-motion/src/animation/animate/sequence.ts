import {
    animateSingleValue,
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    spring,
} from "motion-dom"
import { createAnimationsFromSequence } from "../sequence/create"
import {
    AnimationSequence,
    ResolvedSequenceCallback,
    SequenceOptions,
} from "../sequence/types"
import { animateSubject } from "./subject"

/**
 * Creates an onUpdate callback that fires sequence callbacks when time crosses their thresholds.
 * Tracks previous progress to detect direction (forward/backward).
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
                // Crossed forward
                callback.forward?.()
            } else if (prevTime >= callback.time && currentTime < callback.time) {
                // Crossed backward
                callback.backward?.()
            }
        }

        prevProgress = progress
    }
}

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

    // Add a 0→1 animation with onUpdate to track callbacks
    if (callbacks.length > 0) {
        const callbackAnimation = animateSingleValue(0, 1, {
            duration: totalDuration,
            ease: "linear",
            onUpdate: createCallbackUpdater(callbacks, totalDuration),
        })
        animations.push(callbackAnimation)
    }

    return animations
}
