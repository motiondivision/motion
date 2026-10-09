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
     * The easing is generated over 0 - scale, but velocity is in the
     * value's own units, so scale it to match. Otherwise an interrupted
     * spring hands off the wrong speed, or direction. Only numbers are
     * known to share a unit.
     */
    const { keyframes: k, velocity } = options as {
        keyframes?: unknown[]
        velocity?: number
    }
    const from = k?.[0]
    const to = k?.[k.length - 1]
    const delta =
        typeof from === "number" && typeof to === "number" && to - from

    const generator = createGenerator({
        ...options,
        velocity: delta && velocity ? (velocity * scale) / delta : velocity,
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
