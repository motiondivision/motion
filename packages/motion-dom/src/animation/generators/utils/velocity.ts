import { velocityPerSecond } from "motion-utils"
import { KeyframeGenerator } from "../../types"

const velocitySampleDuration = 5 // ms

export function getGeneratorVelocity(
    resolveValue: (v: number) => number,
    t: number,
    current: number
) {
    const prevT = Math.max(t - velocitySampleDuration, 0)
    return velocityPerSecond(current - resolveValue(prevT), t - prevT)
}

/**
 * A generator's velocity at time t in units/second: analytical where the
 * generator provides it (springs), otherwise by finite difference. Before
 * the animation has started this is its initial velocity.
 */
export function calcGeneratorVelocity(
    generator: KeyframeGenerator<any>,
    t: number,
    initialVelocity = 0
): number {
    if (t <= 0) return initialVelocity

    return generator.velocity
        ? generator.velocity(t)
        : getGeneratorVelocity(
              (s) => generator.next(s).value as number,
              t,
              generator.next(t).value as number
          )
}
