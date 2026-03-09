import { velocityPerSecond } from "motion-utils"

const velocitySampleDuration = 5 // ms

export function getGeneratorVelocity(
    resolveValue: (v: number) => number,
    t: number,
    current: number
) {
    const prevT = Math.max(t - velocitySampleDuration, 0)
    return velocityPerSecond(current - resolveValue(prevT), t - prevT)
}
