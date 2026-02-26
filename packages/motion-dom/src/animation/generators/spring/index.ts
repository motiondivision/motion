import {
    clamp,
    millisecondsToSeconds,
    secondsToMilliseconds,
} from "motion-utils"
import {
    AnimationState,
    KeyframeGenerator,
    SpringOptions,
    Transition,
    ValueAnimationOptions,
} from "../../types"
import { generateLinearEasing } from "../../waapi/utils/linear"
import {
    calcGeneratorDuration,
    maxGeneratorDuration,
} from "../utils/calc-duration"
import { createGeneratorEasing } from "../utils/create-generator-easing"
import { calcGeneratorVelocity } from "../utils/velocity"
import { springDefaults } from "./defaults"
import { calcAngularFreq, findSpring } from "./find"

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
    if (dampingRatio < 1) {
        const angularFreq = calcAngularFreq(undampedAngularFreq, dampingRatio)

        // Underdamped spring
        resolveSpring = (t: number) => {
            const envelope = Math.exp(-dampingRatio * undampedAngularFreq * t)

            return (
                target -
                envelope *
                    (((initialVelocity +
                        dampingRatio * undampedAngularFreq * initialDelta) /
                        angularFreq) *
                        Math.sin(angularFreq * t) +
                        initialDelta * Math.cos(angularFreq * t))
            )
        }
    } else if (dampingRatio === 1) {
        // Critically damped spring
        resolveSpring = (t: number) =>
            target -
            Math.exp(-undampedAngularFreq * t) *
                (initialDelta +
                    (initialVelocity + undampedAngularFreq * initialDelta) * t)
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
    }

    const generator = {
        calculatedDuration: isResolvedFromDuration ? duration || null : null,
        next: (t: number) => {
            const current = resolveSpring(t)

            if (!isResolvedFromDuration) {
                let currentVelocity = t === 0 ? initialVelocity : 0.0

                /**
                 * We only need to calculate velocity for under-damped springs
                 * as over- and critically-damped springs can't overshoot, so
                 * checking only for displacement is enough.
                 */
                if (dampingRatio < 1) {
                    currentVelocity =
                        t === 0
                            ? secondsToMilliseconds(initialVelocity)
                            : calcGeneratorVelocity(resolveSpring, t, current)
                }

                const isBelowVelocityThreshold =
                    Math.abs(currentVelocity) <= restSpeed!
                const isBelowDisplacementThreshold =
                    Math.abs(target - current) <= restDelta!

                state.done =
                    isBelowVelocityThreshold && isBelowDisplacementThreshold
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
