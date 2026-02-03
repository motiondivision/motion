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
    SequenceCallbackData,
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
                callback.do?.()
            } else if (prevTime >= callback.time && currentTime < callback.time) {
                callback.undo?.()
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
    const callbackData: SequenceCallbackData = { callbacks: [], totalDuration: 0 }

    const animationDefinitions = createAnimationsFromSequence(
        sequence,
        options,
        scope,
        { spring },
        callbackData
    )

    animationDefinitions.forEach(({ keyframes, transition }, subject) => {
        animations.push(...animateSubject(subject, keyframes, transition))
    })

    if (callbackData.callbacks.length) {
        const callbackAnimation = animateSingleValue(0, 1, {
            duration: callbackData.totalDuration,
            ease: "linear",
            onUpdate: createCallbackUpdater(
                callbackData.callbacks,
                callbackData.totalDuration
            ),
        })
        animations.push(callbackAnimation)
    }

    return animations
}
