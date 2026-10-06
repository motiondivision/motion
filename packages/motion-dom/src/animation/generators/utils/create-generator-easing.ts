import { millisecondsToSeconds } from "motion-utils"
import { GeneratorFactory, Transition } from "../../types"
import { calcGeneratorDuration, maxGeneratorDuration } from "./calc-duration"

/**
 * Create a progress => progress easing function from a generator.
 */
export function createGeneratorEasing(
    options: Transition,
    scale = 100,
    createGenerator: GeneratorFactory
) {
    /**
     * The easing is generated over a 0 - scale range. Velocity is in the
     * value's own units, so scale it to match, otherwise an interrupted
     * animation hands off the wrong speed and direction.
     */
    const { keyframes, velocity = 0 } = options as {
        keyframes?: number[]
        velocity?: number
    }
    const delta =
        keyframes && keyframes.length > 1
            ? parseFloat(keyframes[keyframes.length - 1] as any) -
              parseFloat(keyframes[0] as any)
            : 0

    const generator = createGenerator({
        ...options,
        velocity: delta ? (velocity * scale) / delta : velocity,
        keyframes: [0, scale],
    })
    const duration = Math.min(
        calcGeneratorDuration(generator),
        maxGeneratorDuration
    )

    return {
        type: "keyframes",
        ease: (progress: number) => {
            return generator.next(duration * progress).value / scale
        },
        duration: millisecondsToSeconds(duration),
    }
}
