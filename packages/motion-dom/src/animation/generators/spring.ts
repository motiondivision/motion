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

    // Underdamped coefficients, hoisted for use in the inlined next() hot path
    let angularFreq: number
    let A: number
    let sinCoeff: number
    let cosCoeff: number

    if (dampingRatio < 1) {
        angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio)

        A =
            (initialVelocity +
                dampingRatio * undampedAngularFreq * initialDelta) /
            angularFreq

        // Underdamped spring
        resolveSpring = (t: number) => {
            const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t)

            return (
                target -
                envelope *
                    (A * Math.sin(angularFreq * t) +
                        initialDelta * Math.cos(angularFreq * t))
            )
        }

        // Analytical derivative of underdamped spring (px/ms)
        sinCoeff =
            dampingRatio * undampedAngularFreq * A + initialDelta * angularFreq
        cosCoeff =
            dampingRatio * undampedAngularFreq * initialDelta - A * angularFreq
        resolveVelocity = (t: number) => {
            const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t)
            return envelope *
                (sinCoeff * Math.sin(angularFreq * t) +
                    cosCoeff * Math.cos(angularFreq * t))
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
            const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t)

            // When performing sinh or cosh values can hit Infinity so we cap them here
            const freqForT = Math.min(dampedAngularFreq * t, 300)

            return (
                target -
                (envelope *
                    ((initialVelocity +
                        dampingRatio * undampedAngularFreq * initialDelta) *
                        Math.sinh(freqForT) +
                        dampedAngularFreq *
                            initialDelta *
                            Math.cosh(freqForT))) /
                    dampedAngularFreq
            )
        }

        // Analytical derivative of overdamped spring (px/ms)
        const P =
            (initialVelocity +
                dampingRatio * undampedAngularFreq * initialDelta) /
            dampedAngularFreq
        const sinhCoeff =
            dampingRatio * undampedAngularFreq * P - initialDelta * dampedAngularFreq
        const coshCoeff =
            dampingRatio * undampedAngularFreq * initialDelta - P * dampedAngularFreq
        resolveVelocity = (t: number) => {
            const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t)
            const freqForT = Math.min(dampedAngularFreq * t, 300)
            return envelope *
                (sinhCoeff * Math.sinh(freqForT) +
                    coshCoeff * Math.cosh(freqForT))
        }
    }

    const generator = {
        calculatedDuration: isResolvedFromDuration ? duration || null : null,
        velocity: (t: number) => secondsToMilliseconds(resolveVelocity(t)),
        next: (t: number) => {
            /**
             * For underdamped physics springs we need both position and
             * velocity each tick. Compute shared trig values once to avoid
             * duplicate Math.exp/sin/cos calls on the hot path.
             */
            if (!isResolvedFromDuration && dampingRatio < 1) {
                const envelope = Math.exp(
                    -dampingRatio * undampedAngularFreq * t
                )
                const sin = Math.sin(angularFreq * t)
                const cos = Math.cos(angularFreq * t)

                const current =
                    target -
                    envelope *
                        (A * sin + initialDelta * cos)
                const currentVelocity = secondsToMilliseconds(
                    envelope *
                        (sinCoeff * sin + cosCoeff * cos)
                )

                state.done =
                    Math.abs(currentVelocity) <= restSpeed! &&
                    Math.abs(target - current) <= restDelta!
                state.value = state.done ? target : current

                return state
            }

            const current = resolveSpring(t)

            if (!isResolvedFromDuration) {
                state.done =
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
