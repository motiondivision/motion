import { millisecondsToSeconds } from "motion-utils"
import { AnyResolvedKeyframe, KeyframeGenerator } from "../../types"
import { calcGeneratorDuration } from "./calc-duration"

export interface KeyframesMetadata {
    keyframes: Array<AnyResolvedKeyframe>
    duration: number
}

const timeStep = 10
const maxDuration = 10_000

export function pregenerateKeyframes(
    generator: KeyframeGenerator<number>
): KeyframesMetadata {
    const keyframes: number[] = []
    const duration = Math.min(
        calcGeneratorDuration(generator, timeStep, maxDuration, keyframes),
        maxDuration
    )

    /**
     * If generating an animation that didn't actually move,
     * generate a second keyframe so we have an origin and target.
     */
    if (keyframes.length === 1) keyframes.push(keyframes[0])

    return {
        keyframes,
        duration: millisecondsToSeconds(duration),
    }
}
