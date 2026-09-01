import { KeyframeGenerator } from "../../types"

/**
 * Implement a practical max duration for keyframe generation
 * to prevent infinite loops
 */
export const maxGeneratorDuration = 20_000

export function calcGeneratorDuration<T>(
    generator: KeyframeGenerator<T>,
    timeStep = 50,
    maxDuration = maxGeneratorDuration,
    keyframes?: T[]
): number {
    let duration = 0
    let state = generator.next(duration)
    keyframes?.push(state.value)

    while (!state.done && duration < maxDuration) {
        duration += timeStep
        state = generator.next(duration)
        keyframes?.push(state.value)
    }

    return duration >= maxDuration ? Infinity : duration
}
