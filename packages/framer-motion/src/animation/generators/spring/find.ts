import { SpringOptions } from "motion-dom"
import {
    millisecondsToSeconds,
    secondsToMilliseconds,
    warning,
} from "motion-utils"
import { clamp } from "../../../utils/clamp"
import { springDefaults } from "./defaults"

/**
 * This is ported from the Framer implementation of duration-based spring resolution.
 */

type Resolver = (num: number) => number

const safeMin = 0.001

export function findSpring({
    duration = springDefaults.duration,
    bounce = springDefaults.bounce,
    velocity = springDefaults.velocity,
    mass = springDefaults.mass,
}: SpringOptions) {
    let envelope: Resolver
    let derivative: Resolver

    warning(
        duration <= secondsToMilliseconds(springDefaults.maxDuration),
        "Spring duration must be 10 seconds or less"
    )

    let dampingRatio = 1 - bounce

    /**
     * Restrict dampingRatio and duration to within acceptable ranges.
     */
    dampingRatio = clamp(
        springDefaults.minDamping,
        springDefaults.maxDamping,
        dampingRatio
    )
    duration = clamp(
        springDefaults.minDuration,
        springDefaults.maxDuration,
        millisecondsToSeconds(duration)
    )

    if (dampingRatio < 1) {
        /**
         * Underdamped spring
         */
        envelope = (undampedFreq) => {
            const exponentialDecay = undampedFreq * dampingRatio
            const delta = exponentialDecay * duration
            const a = exponentialDecay - velocity
            const b = calcAngularFreq(undampedFreq, dampingRatio)
            const c = Math.exp(-delta)
            return safeMin - (a / b) * c
        }

        derivative = (undampedFreq) => {
            const exponentialDecay = undampedFreq * dampingRatio
            const delta = exponentialDecay * duration
            const d = delta * velocity + velocity
            const e =
                Math.pow(dampingRatio, 2) * Math.pow(undampedFreq, 2) * duration
            const f = Math.exp(-delta)
            const g = calcAngularFreq(Math.pow(undampedFreq, 2), dampingRatio)
            const factor = -envelope(undampedFreq) + safeMin > 0 ? -1 : 1
            return (factor * ((d - e) * f)) / g
        }
    } else {
        /**
         * Critically-damped spring
         */
        envelope = (undampedFreq) => {
            const a = Math.exp(-undampedFreq * duration)
            const b = (undampedFreq - velocity) * duration + 1
            return -safeMin + a * b
        }

        derivative = (undampedFreq) => {
            const a = Math.exp(-undampedFreq * duration)
            const b = (velocity - undampedFreq) * (duration * duration)
            return a * b
        }
    }

    const initialGuess = 5 / duration
    const undampedFreq = approximateRoot(envelope, derivative, initialGuess)

    duration = secondsToMilliseconds(duration)
    if (isNaN(undampedFreq)) {
        return {
            stiffness: springDefaults.stiffness,
            damping: springDefaults.damping,
            duration,
        }
    } else {
        const stiffness = Math.pow(undampedFreq, 2) * mass
        return {
            stiffness,
            damping: dampingRatio * 2 * Math.sqrt(mass * stiffness),
            duration,
        }
    }
}

const rootIterations = 12
function approximateRoot(
    envelope: Resolver,
    derivative: Resolver,
    initialGuess: number
): number {
    let result = initialGuess
    for (let i = 1; i < rootIterations; i++) {
        result = result - envelope(result) / derivative(result)
    }
    return result
}

export function calcAngularFreq(undampedFreq: number, dampingRatio: number) {
    return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio)
}
