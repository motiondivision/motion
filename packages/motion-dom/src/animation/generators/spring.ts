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

/**
 * Spring physics must be finite. stiffness and mass are also divisors so must
 * be positive, whereas a damping of 0 is a valid, perpetually oscillating
 * spring. Relational rather than Number.isFinite so numeric strings still
 * coerce.
 */
const isValidPhysics = (value: number | undefined, canBeZero?: boolean) =>
    (canBeZero ? value! >= 0 : value! > 0) && value! < Infinity

/**
 * Returns value if it's usable spring physics, otherwise undefined so callers
 * fall back to the default. An explicit `undefined`, e.g. from a forwarded
 * optional prop, must fall back too. Invalid physics would otherwise resolve
 * to NaN spring values that never report done.
 */
function resolvePhysics(value: number | undefined, canBeZero?: boolean) {
    if (isValidPhysics(value, canBeZero)) return value

    if (process.env.NODE_ENV !== "production") {
        warning(
            value === undefined,
            "Spring stiffness and mass must be positive, damping 0 or greater",
            "spring-invalid-physics"
        )
    }

    return undefined
}

function getSpringOptions(options: SpringOptions) {
    /**
     * Resolve physics before choosing between physics- and duration-based
     * resolution, so an invalid stiffness doesn't also silently discard a
     * valid duration/bounce.
     */
    const validStiffness = resolvePhysics(options.stiffness)
    const validDamping = resolvePhysics(options.damping, true)
    const validMass = resolvePhysics(options.mass)

    const springOptions = {
        ...options,
        stiffness: validStiffness ?? springDefaults.stiffness,
        damping: validDamping ?? springDefaults.damping,
        mass: validMass ?? springDefaults.mass,
        isResolvedFromDuration: false,
        // stiffness/damping/mass overrides duration/bounce
        isTimeDefined:
            (validStiffness ?? validDamping ?? validMass) === undefined &&
            (options.duration !== undefined || options.bounce !== undefined),
    }

    if (springOptions.isTimeDefined) {
        // Time-defined springs should ignore inherited velocity.
        // Velocity from interrupted animations can cause findSpring()
        // to compute wildly different spring parameters, leading to
        // massive oscillation on small-range animations.
        springOptions.velocity = 0

        if (options.visualDuration) {
            const root = (2 * Math.PI) / (options.visualDuration * 1.2)
            springOptions.stiffness = root * root
            springOptions.damping =
                2 *
                clamp(0.05, 1, 1 - (options.bounce || 0)) *
                Math.sqrt(springOptions.stiffness)
        } else {
            Object.assign(springOptions, findSpring(springOptions))
            springOptions.isResolvedFromDuration = true
        }

        /**
         * Non-finite time options degenerate: a NaN bounce gives a NaN
         * damping, an infinite visualDuration a 0 stiffness. Replace the two
         * together, so the relationship duration resolution establishes
         * between them is never left half-overwritten.
         */
        if (
            !isValidPhysics(springOptions.stiffness) ||
            !isValidPhysics(springOptions.damping, true)
        ) {
            springOptions.stiffness = springDefaults.stiffness
            springOptions.damping = springDefaults.damping
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
        isTimeDefined,
    } = getSpringOptions({
        ...options,
        velocity: -millisecondsToSeconds(options.velocity || 0),
    })

    const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass))
    const undampedAngularFreq = millisecondsToSeconds(
        Math.sqrt(stiffness / mass)
    )
    const decay = dampingRatio * undampedAngularFreq

    /**
     * Everything that changes when the spring is retargeted: written by
     * retarget() and update(), read by the resolvers. Grouped on one object,
     * like the coefficients (c) below. Writing doubles to object fields
     * measured marginally faster than to captured let variables in optimised
     * code; neither allocates, so this is a grouping choice, not a GC one.
     */
    const s = {
        target,
        delta: target - origin,
        velocity: velocity || 0.0,
        restSpeed: 0,
        restDelta: 0,
    }

    /**
     * If we're working on a granular scale, use smaller defaults for determining
     * when the spring is finished.
     *
     * These defaults have been selected empirically based on what strikes a good
     * ratio between feeling good and finishing as soon as changes are imperceptible.
     */
    const setRestThresholds = () => {
        const isGranularScale = Math.abs(s.delta) < 5
        s.restSpeed =
            options.restSpeed ||
            (isGranularScale
                ? springDefaults.restSpeed.granular
                : springDefaults.restSpeed.default)
        s.restDelta =
            options.restDelta ||
            (isGranularScale
                ? springDefaults.restDelta.granular
                : springDefaults.restDelta.default)
    }
    setRestThresholds()

    let resolveSpring: (v: number) => number
    let resolveVelocity: (t: number) => number

    /**
     * Derives the coefficients that depend on origin, target and initial
     * velocity. Called once now and again whenever the spring is retargeted.
     */
    let update: VoidFunction

    if (dampingRatio < 1) {
        const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio)

        /**
         * A is the position coefficient, sinC/cosC the coefficients of the
         * analytical derivative (px/ms). The exp/sin/cos terms depend only
         * on t, so they're memoized by t independently of the target: a
         * spring retargeted every frame samples the same t each frame and
         * skips the transcendentals entirely.
         */
        const c = { A: 0, sinC: 0, cosC: 0, t: -1, env: 0, sin: 0, cos: 0 }

        update = () => {
            c.A = (s.velocity + decay * s.delta) / angularFreq
            c.sinC = decay * c.A + s.delta * angularFreq
            c.cosC = decay * s.delta - c.A * angularFreq
        }

        const sample = (t: number) => {
            if (t !== c.t) {
                c.t = t
                c.env = Math.exp(-decay * t)
                c.sin = Math.sin(angularFreq * t)
                c.cos = Math.cos(angularFreq * t)
            }
        }

        // Underdamped spring
        resolveSpring = (t: number) => {
            sample(t)
            return s.target - c.env * (c.A * c.sin + s.delta * c.cos)
        }

        resolveVelocity = (t: number) => {
            sample(t)
            return c.env * (c.sinC * c.sin + c.cosC * c.cos)
        }
    } else if (dampingRatio === 1) {
        // Critically damped spring
        resolveSpring = (t: number) =>
            s.target -
            Math.exp(-undampedAngularFreq * t) *
                (s.delta + (s.velocity + undampedAngularFreq * s.delta) * t)

        // Analytical derivative of critically damped spring (px/ms)
        const c = { C: 0 }
        update = () => {
            c.C = s.velocity + undampedAngularFreq * s.delta
        }
        resolveVelocity = (t: number) =>
            Math.exp(-undampedAngularFreq * t) *
            (undampedAngularFreq * c.C * t - s.velocity)
    } else {
        // Overdamped spring
        const dampedAngularFreq =
            undampedAngularFreq * Math.sqrt(dampingRatio * dampingRatio - 1)

        resolveSpring = (t: number) => {
            const envelope = Math.exp(-decay * t)

            // When performing sinh or cosh values can hit Infinity so we cap them here
            const freqForT = Math.min(dampedAngularFreq * t, 300)

            return (
                s.target -
                (envelope *
                    ((s.velocity + decay * s.delta) * Math.sinh(freqForT) +
                        dampedAngularFreq * s.delta * Math.cosh(freqForT))) /
                    dampedAngularFreq
            )
        }

        // Analytical derivative of overdamped spring (px/ms)
        const c = { P: 0, sinh: 0, cosh: 0 }
        update = () => {
            c.P = (s.velocity + decay * s.delta) / dampedAngularFreq
            c.sinh = decay * c.P - s.delta * dampedAngularFreq
            c.cosh = decay * s.delta - c.P * dampedAngularFreq
        }
        resolveVelocity = (t: number) => {
            const envelope = Math.exp(-decay * t)
            const freqForT = Math.min(dampedAngularFreq * t, 300)
            return (
                envelope *
                (c.sinh * Math.sinh(freqForT) + c.cosh * Math.cosh(freqForT))
            )
        }
    }

    update()

    const calculatedDuration = isResolvedFromDuration ? duration || null : null

    const generator = {
        calculatedDuration,
        /**
         * Aim the spring at a new target from its current position and
         * velocity, reusing the resolved physics and closures.
         */
        retarget: (keyframes: number[], newVelocity: number) => {
            s.target = keyframes[keyframes.length - 1]
            s.delta = s.target - keyframes[0]
            // Time-defined springs ignore inherited velocity, see getSpringOptions
            s.velocity = isTimeDefined ? 0 : -millisecondsToSeconds(newVelocity)
            // Default thresholds depend on the scale of the new delta
            if (!(options.restSpeed && options.restDelta)) setRestThresholds()
            // Invalidate any duration lazily cached by JSAnimation
            generator.calculatedDuration = calculatedDuration
            state.done = false
            update()
        },
        velocity: (t: number) => secondsToMilliseconds(resolveVelocity(t)),
        next: (t: number) => {
            const current = resolveSpring(t)

            if (!isResolvedFromDuration) {
                const currentVelocity = secondsToMilliseconds(
                    resolveVelocity(t)
                )
                state.done =
                    Math.abs(currentVelocity) <= s.restSpeed &&
                    Math.abs(s.target - current) <= s.restDelta
            } else {
                state.done = t >= duration!
            }

            state.value = state.done ? s.target : current

            return state
        },
        toString: () => {
            const easingDuration = Math.min(
                calcGeneratorDuration(generator),
                maxGeneratorDuration
            )

            const easing = generateLinearEasing(
                (progress: number) =>
                    generator.next(easingDuration * progress).value,
                easingDuration,
                30
            )

            return easingDuration + "ms " + easing
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
