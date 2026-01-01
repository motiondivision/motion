import { millisecondsToSeconds } from "motion-utils"
import { KeyframeGenerator } from "../../types"
import { calcGeneratorVelocity } from "./velocity"

/**
 * Simulation frame data - stores both position and velocity
 * This enables accurate state extraction when animation is interrupted
 */
export interface SimulationFrame {
    time: number // ms
    position: number
    velocity: number
}

export interface KeyframesWithVelocity {
    frames: SimulationFrame[]
    keyframes: number[]
    duration: number // seconds
}

const timeStep = 10 // ~60fps equivalent
const maxDuration = 10000 // 10 seconds max

/**
 * Pre-generate keyframes with velocity data for accurate mid-animation state extraction
 *
 * Based on SSGOI's css-runner approach:
 * - Pre-simulates entire spring animation synchronously
 * - Records position AND velocity at each frame
 * - Enables O(log n) state lookup via binary search + interpolation
 */
export function pregenerateKeyframesWithVelocity(
    generator: KeyframeGenerator<number>,
    resolveValue: (t: number) => number
): KeyframesWithVelocity {
    let timestamp = 0
    let state = generator.next(0)

    const frames: SimulationFrame[] = [
        {
            time: 0,
            position: state.value,
            velocity: 0,
        },
    ]
    const keyframes: number[] = [state.value]

    timestamp = timeStep
    while (!state.done && timestamp < maxDuration) {
        state = generator.next(timestamp)
        const velocity = calcGeneratorVelocity(resolveValue, timestamp, state.value)

        frames.push({
            time: timestamp,
            position: state.value,
            velocity,
        })
        keyframes.push(state.value)

        timestamp += timeStep
    }

    const duration = timestamp - timeStep

    // If animation didn't move, ensure we have at least 2 keyframes
    if (keyframes.length === 1) {
        keyframes.push(state.value)
        frames.push({
            time: timeStep,
            position: state.value,
            velocity: 0,
        })
    }

    return {
        frames,
        keyframes,
        duration: millisecondsToSeconds(duration),
    }
}

/**
 * Binary search + linear interpolation to find exact state at any elapsed time
 * O(log n) complexity for fast lookups
 *
 * This is the key optimization from SSGOI's css-runner:
 * Instead of creating a new JSAnimation and sampling, we directly
 * interpolate from pre-recorded simulation data
 */
export function interpolateFrame(
    frames: SimulationFrame[],
    elapsedTime: number
): { position: number; velocity: number } {
    if (frames.length === 0) {
        return { position: 0, velocity: 0 }
    }

    const firstFrame = frames[0]
    const lastFrame = frames[frames.length - 1]

    // Bounds check
    if (elapsedTime <= 0) {
        return { position: firstFrame.position, velocity: firstFrame.velocity }
    }

    if (elapsedTime >= lastFrame.time) {
        return { position: lastFrame.position, velocity: lastFrame.velocity }
    }

    // Binary search for the frame
    let low = 0
    let high = frames.length - 1

    while (low < high - 1) {
        const mid = Math.floor((low + high) / 2)
        if (frames[mid].time <= elapsedTime) {
            low = mid
        } else {
            high = mid
        }
    }

    // Linear interpolation between two frames
    const f1 = frames[low]
    const f2 = frames[high]
    const t = (elapsedTime - f1.time) / (f2.time - f1.time)

    return {
        position: f1.position + (f2.position - f1.position) * t,
        velocity: f1.velocity + (f2.velocity - f1.velocity) * t,
    }
}
