import {
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    motionValue,
    spring,
} from "motion-dom"
import { createAnimationsFromSequence } from "../sequence/create"
import { AnimationSequence, SequenceOptions } from "../sequence/types"
import { flattenSequence } from "../sequence/utils/flatten"
import { animateSubject } from "./subject"

export function animateSequence(
    sequence: AnimationSequence,
    options?: SequenceOptions,
    scope?: AnimationScope
) {
    const animations: AnimationPlaybackControlsWithThen[] = []

    sequence = flattenSequence(sequence)

    /**
     * Pre-process: replace function segments with MotionValue segments,
     * subscribe callbacks immediately
     */
    const processedSequence = sequence.map((segment) => {
        if (Array.isArray(segment) && typeof segment[0] === "function") {
            const callback = segment[0] as (value: any) => void
            const mv = motionValue(0)
            mv.on("change", callback)

            if (segment.length === 1) {
                return [mv, [0, 1]] as any
            } else if (segment.length === 2) {
                return [mv, [0, 1], segment[1]] as any
            } else {
                return [mv, segment[1], segment[2]] as any
            }
        }
        return segment
    }) as AnimationSequence

    const animationDefinitions = createAnimationsFromSequence(
        processedSequence,
        options,
        scope,
        { spring }
    )

    animationDefinitions.forEach(({ keyframes, transition }, subject) => {
        animations.push(...animateSubject(subject, keyframes, transition))
    })

    return animations
}
