import type { JSAnimation, ValueAnimationOptions } from "motion-dom"
import type { NativeTable } from "./types"

/**
 * About how often, in ms, an animation is sampled.
 */
export const SAMPLE_INTERVAL = 10

/**
 * Longer animations, or infinite ones whose cycle is longer than this, run
 * in JS instead.
 */
const maxSamples = 2000

/**
 * Sample a JSAnimation, including delay and repeats, into a table the UI
 * thread can play. An infinite animation is sampled for two iterations,
 * which covers every repeatType, and looped.
 */
export function createTable(
    sampler: JSAnimation<any>,
    { delay = 0, repeat = 0, repeatDelay = 0 }: ValueAnimationOptions<any>
): NativeTable | undefined {
    const iteration = sampler.duration * 1000 + repeatDelay
    const loopStart = Math.max(delay, 0)
    const loopLength = repeat === Infinity ? iteration * 2 : 0
    const duration = loopLength
        ? loopStart + loopLength
        : delay + iteration * (repeat + 1) - repeatDelay

    const count = Math.ceil(duration / SAMPLE_INTERVAL)
    if (!(count > 0 && count <= maxSamples)) return

    const samples = []
    for (let i = 0; i <= count; i++) {
        samples.push(sampler.sample((i / count) * duration).value)
    }

    return { samples, duration, loopStart, loopLength }
}
