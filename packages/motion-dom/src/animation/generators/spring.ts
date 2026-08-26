import {
    clamp,
    millisecondsToSeconds,
    secondsToMilliseconds,
    warning,
} from "motion-utils"
import {
    AnimationState,
    KeyframeGenerator,
    SpringOptions,
    Transition,
    ValueAnimationOptions,
} from "../types"
import { generateLinearEasing } from "../waapi/utils/linear"
import {
    calcGeneratorDuration,
    maxGeneratorDuration,
} from "./utils/calc-duration"
import { createGeneratorEasing } from "./utils/create-generator-easing"

const springDefaults = {
    // Default spring physics
    stiffness: 100,
    damping: 10,
    mass: 1.0,
    velocity: 0.0,

    // Default duration/bounce-based options
    duration: 800, // in ms
    bounce: 0.3,
    visualDuration: 0.3, // in seconds

    // Rest thresholds
    restSpeed: {
        granular: 0.01,
        default: 2,
    },
    restDelta: {
        granular: 0.005,
        default: 0.5,
    },

    // Limits
    minDuration: 0.01, // in seconds
    maxDuration: 10.0, // in seconds
    minDamping: 0.05,
    maxDamping: 1,
}

function calcAngularFreq(undampedFreq: number, dampingRatio: number) {
    return undampedFreq * Math.sqrt(1 - dampingRatio * dampingRatio)
}

const rootIterations = 12
function approximateRoot(
    envelope: (num: number) => number,
    derivative: (num: number) => number,
    initialGuess: number
): number {
    let result = initialGuess
    for (let i = 1; i < rootIterations; i++) {
        result = result - envelope(result) / derivative(result)
    }
    return result
}

/**
 * This is ported from the Framer implementation of duration-based spring resolution.
 */
const safeMin = 0.001

function findSpring({
    duration = springDefaults.duration,
    bounce = springDefaults.bounce,
    velocity = springDefaults.velocity,
    mass = springDefaults.mass,
}: SpringOptions) {
    let envelope: (num: number) => number
    let derivative: (num: number) => number

    warning(
        duration <= secondsToMilliseconds(springDefaults.maxDuration),
        "Spring duration must be 10 seconds or less",
        "spring-duration-limit"
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
                dampingRatio *
                dampingRatio *
                undampedFreq *
                undampedFreq *
                duration
            const f = Math.exp(-delta)
            const g = calcAngularFreq(undampedFreq * undampedFreq, dampingRatio)
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
        const stiffness = undampedFreq * undampedFreq * mass
        return {
            stiffness,
            damping: dampingRatio * 2 * Math.sqrt(mass * stiffness),
            duration,
        }
    }
}

const durationKeys = ["duration", "bounce"]
const physicsKeys = ["stiffness", "damping", "mass"]

function isSpringType(options: SpringOptions, keys: string[]) {
    return keys.some((key) => (options as any)[key] !== undefined)
}

function getSpringOptions(options: SpringOptions) {
    let springOptions = {
        velocity: springDefaults.velocity,
        stiffness: springDefaults.stiffness,
        damping: springDefaults.damping,
        mass: springDefaults.mass,
        isResolvedFromDuration: false,
        ...options,
    }
    // stiffness/damping/mass overrides duration/bounce
    if (
        !isSpringType(options, physicsKeys) &&
        isSpringType(options, durationKeys)
    ) {
        // Time-defined springs should ignore inherited velocity.
        // Velocity from interrupted animations can cause findSpring()
        // to compute wildly different spring parameters, leading to
        // massive oscillation on small-range animations.
        springOptions.velocity = 0

        if (options.visualDuration) {
            const visualDuration = options.visualDuration
            const root = (2 * Math.PI) / (visualDuration * 1.2)
            const stiffness = root * root
            const damping =
                2 *
                clamp(0.05, 1, 1 - (options.bounce || 0)) *
                Math.sqrt(stiffness)

            springOptions = {
                ...springOptions,
                mass: springDefaults.mass,
                stiffness,
                damping,
            }
        } else {
            const derived = findSpring({ ...options, velocity: 0 })

            springOptions = {
                ...springOptions,
                ...derived,
                mass: springDefaults.mass,
            }
            springOptions.isResolvedFromDuration = true
        }
    }

    return springOptions
}

function spring(
    optionsOrVisualDuration:
        | ValueAnimationOptions<number>
        | number = springDefaults.visualDuration,
    bounce = springDefaults.bounce
): KeyframeGenerator<number> {
    const options =
        typeof optionsOrVisualDuration !== "object"
            ? ({
                  visualDuration: optionsOrVisualDuration,
                  keyframes: [0, 1],
                  bounce,
              } as ValueAnimationOptions<number>)
            : optionsOrVisualDuration

    let { restSpeed, restDelta } = options

    const origin = options.keyframes[0]
    const target = options.keyframes[options.keyframes.length - 1]

    /**
     * This is the Iterator-spec return value. We ensure it's mutable rather than using a generator
     * to reduce GC during animation.
     */
    const state: AnimationState<number> = { done: false, value: origin }

    const {
        stiffness,
        damping,
        mass,
        duration,
        velocity,
        isResolvedFromDuration,
    } = getSpringOptions({
        ...options,
        velocity: -millisecondsToSeconds(options.velocity || 0),
    })

    const initialVelocity = velocity || 0.0
    const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass))

    const initialDelta = target - origin
    const undampedAngularFreq = millisecondsToSeconds(
        Math.sqrt(stiffness / mass)
    )
    const decay = dampingRatio * undampedAngularFreq

    /**
     * If we're working on a granular scale, use smaller defaults for determining
     * when the spring is finished.
     *
     * These defaults have been selected emprically based on what strikes a good
     * ratio between feeling good and finishing as soon as changes are imperceptible.
     */
    const isGranularScale = Math.abs(initialDelta) < 5
    restSpeed ||= isGranularScale
        ? springDefaults.restSpeed.granular
        : springDefaults.restSpeed.default
    restDelta ||= isGranularScale
        ? springDefaults.restDelta.granular
        : springDefaults.restDelta.default

    let resolveSpring: (v: number) => number
    let resolveVelocity: (t: number) => number

    if (dampingRatio < 1) {
        const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio)

        const A = (initialVelocity + decay * initialDelta) / angularFreq

        // Coefficients for the analytical derivative (px/ms)
        const sinCoeff = decay * A + initialDelta * angularFreq
        const cosCoeff = decay * initialDelta - A * angularFreq

        /**
         * The underdamped hot path needs both position and velocity every
         * frame and they share the same exp/sin/cos terms, so sample both
         * at once, memoized by t, to only calculate them once per frame.
         */
        let sampledT = -1
        let position = 0
        let velocityAtT = 0
        const sample = (t: number) => {
            if (t !== sampledT) {
                sampledT = t
                const envelope = Math.exp(-decay * t)
                const sin = Math.sin(angularFreq * t)
                const cos = Math.cos(angularFreq * t)
                position = target - envelope * (A * sin + initialDelta * cos)
                velocityAtT = envelope * (sinCoeff * sin + cosCoeff * cos)
            }
        }

        // Underdamped spring
        resolveSpring = (t: number) => {
            sample(t)
            return position
        }

        resolveVelocity = (t: number) => {
            sample(t)
            return velocityAtT
        }
    } else if (dampingRatio === 1) {
        // Critically damped spring
        resolveSpring = (t: number) =>
            target -
            Math.exp(-undampedAngularFreq * t) *
                (initialDelta +
                    (initialVelocity + undampedAngularFreq * initialDelta) * t)

        // Analytical derivative of critically damped spring (px/ms)
        const C = initialVelocity + undampedAngularFreq * initialDelta
        resolveVelocity = (t: number) =>
            Math.exp(-undampedAngularFreq * t) *
                (undampedAngularFreq * C * t - initialVelocity)
    } else {
        // Overdamped spring
        const dampedAngularFreq =
            undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1)

        resolveSpring = (t: number) => {
            const envelope = Math.exp(-decay * t)

            // When performing sinh or cosh values can hit Infinity so we cap them here
            const freqForT = Math.min(dampedAngularFreq * t, 300)

            return (
                target -
                (envelope *
                    ((initialVelocity + decay * initialDelta) *
                        Math.sinh(freqForT) +
                        dampedAngularFreq *
                            initialDelta *
                            Math.cosh(freqForT))) /
                    dampedAngularFreq
            )
        }

        // Analytical derivative of overdamped spring (px/ms)
        const P = (initialVelocity + decay * initialDelta) / dampedAngularFreq
        const sinhCoeff = decay * P - initialDelta * dampedAngularFreq
        const coshCoeff = decay * initialDelta - P * dampedAngularFreq
        resolveVelocity = (t: number) => {
            const envelope = Math.exp(-decay * t)
            const freqForT = Math.min(dampedAngularFreq * t, 300)
            return (
                envelope *
                (sinhCoeff * Math.sinh(freqForT) +
                    coshCoeff * Math.cosh(freqForT))
            )
        }
    }

    const generator = {
        calculatedDuration: isResolvedFromDuration ? duration || null : null,
        velocity: (t: number) => secondsToMilliseconds(resolveVelocity(t)),
        next: (t: number) => {
            const current = resolveSpring(t)

            if (!isResolvedFromDuration) {
                const currentVelocity = secondsToMilliseconds(
                    resolveVelocity(t)
                )
                state.done =
                    Math.abs(currentVelocity) <= restSpeed! &&
                    Math.abs(target - current) <= restDelta!
            } else {
                state.done = t >= duration!
            }

            state.value = state.done ? target : current

            return state
        },
        toString: () => {
            const calculatedDuration = Math.min(
                calcGeneratorDuration(generator),
                maxGeneratorDuration
            )

            const easing = generateLinearEasing(
                (progress: number) =>
                    generator.next(calculatedDuration * progress).value,
                calculatedDuration,
                30
            )

            return calculatedDuration + "ms " + easing
        },
        toTransition: () => {},
    }

    return generator
}

spring.applyToOptions = (options: Transition) => {
    const generatorOptions = createGeneratorEasing(options as any, 100, spring)

    options.ease = generatorOptions.ease
    options.duration = secondsToMilliseconds(generatorOptions.duration)
    options.type = "keyframes"
    return options
}

export { spring }
