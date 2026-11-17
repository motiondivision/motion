import { clamp, invariant, pipe } from "motion-utils"
import { mix } from "../utils/mix"
import { Mixer } from "../utils/mix/types"
import { keyframes as keyframesGenerator } from "./generators/keyframes"
import { calcGeneratorDuration } from "./generators/utils/calc-duration"
import {
    AnimationState,
    AnyResolvedKeyframe,
    GeneratorFactory,
    KeyframeGenerator,
    ValueAnimationOptions,
} from "./types"
import { replaceTransitionType } from "./utils/replace-transition-type"

/**
 * What it takes to sample one value's animation at a time: its options,
 * its generator and the durations worked out from them. A
 * MultiValueAnimation is many tracks sharing a clock.
 */
export interface Track<T extends AnyResolvedKeyframe = any> {
    options: ValueAnimationOptions<T>
    generator: KeyframeGenerator<T>
    mirroredGenerator: KeyframeGenerator<T> | undefined
    /**
     * If the generator doesn't support mixing numbers, keyframes are
     * replaced with [0, 100] and this maps that to the actual keyframes.
     * 100 is chosen instead of 1 as it works nicer with spring animations.
     */
    mixKeyframes: Mixer<T> | undefined
    calculatedDuration: number
    resolvedDuration: number
    totalDuration: number
    /**
     * Reusable state for the delay phase, so it isn't made every frame.
     */
    delayState?: AnimationState<T>
}

const percentToProgress = (percent: number) => percent / 100

export function initTrack<T extends AnyResolvedKeyframe>(track: Track<T>) {
    const { options } = track

    replaceTransitionType(options)

    const {
        type = keyframesGenerator,
        repeat = 0,
        repeatDelay = 0,
        repeatType,
        velocity = 0,
    } = options
    let { keyframes } = options

    const generatorFactory = (type as GeneratorFactory) || keyframesGenerator

    if (
        process.env.NODE_ENV !== "production" &&
        generatorFactory !== keyframesGenerator
    ) {
        invariant(
            keyframes.length <= 2,
            `Only two keyframes currently supported with spring and inertia animations. Trying to animate ${keyframes}`,
            "spring-two-frames"
        )
    }

    /**
     * This runs again when a spring is flattened to attach it to a
     * timeline, and the keyframes generator blends values itself.
     */
    track.mixKeyframes = undefined

    if (
        generatorFactory !== keyframesGenerator &&
        typeof keyframes[0] !== "number"
    ) {
        track.mixKeyframes = pipe(
            percentToProgress,
            options.mixer?.(keyframes[0], keyframes[1]) ||
                mix(keyframes[0], keyframes[1])
        ) as (t: number) => T

        keyframes = [0 as T, 100 as T]
    }

    const generator = generatorFactory(
        keyframes === options.keyframes ? options : { ...options, keyframes }
    )

    /**
     * A mirror repeat ping pongs between this generator and one that
     * outputs the mirrored (not reversed) animation.
     */
    if (repeatType === "mirror") {
        track.mirroredGenerator = generatorFactory({
            ...options,
            keyframes: [...keyframes].reverse(),
            velocity: -velocity,
        })
    }

    /**
     * A generator without a duration (a spring with repeats) has one
     * worked out here and cached on it.
     */
    if (generator.calculatedDuration === null) {
        generator.calculatedDuration = calcGeneratorDuration(generator)
    }

    const { calculatedDuration } = generator
    track.calculatedDuration = calculatedDuration
    track.resolvedDuration = calculatedDuration + repeatDelay
    track.totalDuration = track.resolvedDuration * (repeat + 1) - repeatDelay
    track.generator = generator
}

/**
 * The track's state `currentTime` ms after its delay.
 */
export function generateTrack<T extends AnyResolvedKeyframe>(
    track: Track<T>,
    currentTime: number,
    isInDelayPhase: boolean
): AnimationState<T> {
    const {
        generator,
        totalDuration,
        mixKeyframes,
        mirroredGenerator,
        resolvedDuration,
    } = track
    const { keyframes, repeat, repeatType, repeatDelay } = track.options

    let elapsed = currentTime
    let frameGenerator = generator

    if (repeat) {
        /**
         * Progress through all iterations, so 2.5 is midway through the
         * third.
         */
        const progress = Math.min(currentTime, totalDuration) / resolvedDuration

        let currentIteration = Math.floor(progress)
        let iterationProgress = progress % 1.0

        /**
         * If iteration progress is 1 we count that as the end
         * of the previous iteration.
         */
        if (!iterationProgress && progress >= 1) {
            iterationProgress = 1
        }

        iterationProgress === 1 && currentIteration--

        currentIteration = Math.min(currentIteration, repeat + 1)

        if (currentIteration % 2) {
            if (repeatType === "reverse") {
                iterationProgress = 1 - iterationProgress
                if (repeatDelay) {
                    iterationProgress -= repeatDelay / resolvedDuration
                }
            } else if (repeatType === "mirror") {
                frameGenerator = mirroredGenerator!
            }
        }

        elapsed = clamp(0, 1, iterationProgress) * resolvedDuration
    }

    /**
     * In negative time the value is the initial keyframe, so delay: x,
     * duration: 0 animations don't finish instantly.
     */
    let state: AnimationState<T>
    if (isInDelayPhase) {
        state = track.delayState ||= {
            done: false,
            value: undefined as unknown as T,
        }
        state.value = keyframes[0]
    } else {
        state = frameGenerator.next(elapsed)
    }

    if (mixKeyframes && !isInDelayPhase) {
        state.value = mixKeyframes(state.value as number)
    }

    return state
}
