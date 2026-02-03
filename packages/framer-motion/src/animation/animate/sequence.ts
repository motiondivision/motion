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
                callback.enter?.()
            } else if (prevTime >= callback.time && currentTime < callback.time) {
                callback.leave?.()
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
    const callbacks: ResolvedSequenceCallback[] = []

    const animationDefinitions = createAnimationsFromSequence(
        sequence,
        options,
        scope,
        { spring },
        callbacks
    )

    animationDefinitions.forEach(({ keyframes, transition }, subject) => {
        animations.push(...animateSubject(subject, keyframes, transition))
    })

    if (callbacks.length > 0) {
        /**
         * Read totalDuration from the first animation's transition,
         * since all animations in a sequence share the same duration.
         */
        const firstTransition = animationDefinitions.values().next().value
            ?.transition
        const totalDuration = firstTransition
            ? (Object.values(firstTransition)[0] as any)?.duration ?? 0
            : 0

        const callbackAnimation = animateSingleValue(0, 1, {
            duration: totalDuration,
            ease: "linear",
            onUpdate: createCallbackUpdater(callbacks, totalDuration),
        })
        animations.push(callbackAnimation)
    }

    return animations
}
