import { mixNumber, UnresolvedValueKeyframe } from "motion-dom"
import { Easing, getEasingForSegment, removeItem } from "motion-utils"
import type { ValueSequence } from "../types"

export function eraseKeyframes(
    sequence: ValueSequence,
    startTime: number,
    endTime: number
): void {
    for (let i = 0; i < sequence.length; i++) {
        const keyframe = sequence[i]

        if (keyframe.at > startTime && keyframe.at < endTime) {
            removeItem(sequence, keyframe)

            // If we remove this item we have to push the pointer back one
            i--
        }
    }
}

export function addKeyframes(
    sequence: ValueSequence,
    keyframes: UnresolvedValueKeyframe[],
    easing: Easing | Easing[],
    offset: number[],
    startTime: number,
    endTime: number
): void {
    /**
     * Erase every existing value between currentTime and targetTime,
     * this will essentially splice this timeline into any currently
     * defined ones.
     */
    eraseKeyframes(sequence, startTime, endTime)

    for (let i = 0; i < keyframes.length; i++) {
        sequence.push({
            value: keyframes[i],
            at: mixNumber(startTime, endTime, offset[i]),
            easing: getEasingForSegment(easing, i),
        })
    }
}
