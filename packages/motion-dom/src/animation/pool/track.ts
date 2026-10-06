import { clamp, invariant, pipe } from "motion-utils"
import { mix } from "../../utils/mix"
import { Mixer } from "../../utils/mix/types"
import { inertia } from "../generators/inertia"
import { keyframes as keyframesGenerator } from "../generators/keyframes"
import { calcGeneratorDuration } from "../generators/utils/calc-duration"
import { calcGeneratorVelocity } from "../generators/utils/velocity"
import { getFinalKeyframe } from "../keyframes/get-final"
import {
    AnimationState,
    GeneratorFactory,
    KeyframeGenerator,
    ValueAnimationOptions,
} from "../types"
import { replaceTransitionType } from "../utils/replace-transition-type"

const percentToProgress = (percent: number) => percent / 100

/**
 * A track is one value's animation as data: its generator and timing,
 * with no clock of its own. A JSAnimation is a clock around one track, a
 * Pool is a clock around many. Sampling a track at a time is the
 * same calculation in both, so interrupting, pausing or moving a track
 * between the main thread and the compositor can read its exact value and
 * velocity without a render.
 */
export interface Track<T extends number | string = number | string> {
    options: ValueAnimationOptions<T>
    generator: KeyframeGenerator<T>
    mirroredGenerator?: KeyframeGenerator<T>
    /**
     * If the generator doesn't support mixing the keyframes, it animates
     * [0, 100] and this maps that to the keyframes.
     */
    mixKeyframes?: Mixer<T>
    calculatedDuration: number
    resolvedDuration: number
    totalDuration: number
    /**
     * Reusable state for the delay phase and sampled values, to avoid
     * allocating a new object every frame.
     */
    state: AnimationState<T>
}

export function createTrack<T extends number | string>(
    options: ValueAnimationOptions<T>
): Track<T> {
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

    let mixKeyframes: Mixer<T> | undefined
    if (
        generatorFactory !== keyframesGenerator &&
        typeof keyframes[0] !== "number"
    ) {
        mixKeyframes = pipe(
            percentToProgress,
            mix(keyframes[0], keyframes[1])
        ) as (t: number) => T

        keyframes = [0 as T, 100 as T]
    }

    const generator = generatorFactory(
        keyframes === options.keyframes ? options : { ...options, keyframes }
    )

    /**
     * If we have a mirror repeat type we need to create a second generator that outputs the
     * mirrored (not reversed) animation and later ping pong between the two generators.
     */
    let mirroredGenerator: KeyframeGenerator<T> | undefined
    if (repeatType === "mirror") {
        mirroredGenerator = generatorFactory({
            ...options,
            keyframes: [...keyframes].reverse(),
            velocity: -velocity,
        })
    }

    /**
     * If duration is undefined and we have repeat options,
     * we need to calculate a duration from the generator.
     *
     * We set it to the generator itself to cache the duration.
     * Any timeline resolver will need to have already precalculated
     * the duration by this step.
     */
    if (generator.calculatedDuration === null) {
        generator.calculatedDuration = calcGeneratorDuration(generator)
    }

    const { calculatedDuration } = generator
    const resolvedDuration = calculatedDuration + repeatDelay

    return {
        options,
        generator,
        mirroredGenerator,
        mixKeyframes,
        calculatedDuration,
        resolvedDuration,
        totalDuration: resolvedDuration * (repeat + 1) - repeatDelay,
        state: { done: false, value: undefined as unknown as T },
    }
}

export interface TrackSample<T> {
    value: T
    /**
     * Whether the track has reached its end at this time.
     */
    done: boolean
    /**
     * The track's time with its delay removed, clamped to its duration.
     */
    time: number
}

/**
 * The track's value at `time` (ms since the track started, including its
 * delay) when played at `speed`. With `finished`, it's held at its end.
 * The returned state is reused between calls.
 */
export function sampleTrack<T extends number | string>(
    track: Track<T>,
    time: number,
    speed = 1,
    finished = false
): TrackSample<T> {
    const {
        generator,
        totalDuration,
        mixKeyframes,
        mirroredGenerator,
        resolvedDuration,
        calculatedDuration,
    } = track

    const { delay = 0, keyframes, repeat, repeatType, repeatDelay } =
        track.options

    // Rebase on delay
    const timeWithoutDelay = time - delay * (speed >= 0 ? 1 : -1)
    const isInDelayPhase =
        speed >= 0 ? timeWithoutDelay < 0 : timeWithoutDelay > totalDuration
    let currentTime = Math.max(timeWithoutDelay, 0)

    // If this animation has finished, set the current time to the total duration.
    if (finished) currentTime = totalDuration

    let elapsed = currentTime
    let frameGenerator = generator

    if (repeat) {
        /**
         * Get the current progress (0-1) of the animation. If t is >
         * than duration we'll get values like 2.5 (midway through the
         * third iteration)
         */
        const progress = Math.min(currentTime, totalDuration) / resolvedDuration

        /**
         * Get the current iteration (0 indexed). For instance the floor of
         * 2.5 is 2.
         */
        let currentIteration = Math.floor(progress)

        /**
         * Get the current progress of the iteration by taking the remainder
         * so 2.5 is 0.5 through iteration 2
         */
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

        /**
         * Reverse progress if we're not running in "normal" direction
         */
        const isOddIteration = Boolean(currentIteration % 2)
        if (isOddIteration) {
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
     * If we're in negative time, set state as the initial keyframe.
     * This prevents delay: x, duration: 0 animations from finishing
     * instantly.
     */
    let state: AnimationState<T>
    if (isInDelayPhase) {
        state = track.state
        state.value = keyframes[0]
        state.done = false
    } else {
        state = frameGenerator.next(elapsed)
    }

    if (mixKeyframes && !isInDelayPhase) {
        state.value = mixKeyframes(state.value as number)
    }

    let { done } = state

    if (!isInDelayPhase && calculatedDuration !== null) {
        done = speed >= 0 ? currentTime >= totalDuration : currentTime <= 0
    }

    const sample = state as TrackSample<T>
    sample.done = done
    sample.time = currentTime

    return sample
}

/**
 * The value a track settles on when it finishes.
 */
export function getTrackEnd<T extends number | string>(
    { options }: Track<T>,
    speed: number
) {
    return getFinalKeyframe(
        options.keyframes,
        options,
        options.finalKeyframe,
        speed
    )
}

/**
 * Whether a track outputs its generator's last value, rather than its
 * target keyframe, when it ends.
 */
export const isInertia = (track: Track<any>) => track.options.type === inertia

/**
 * The track's velocity, in units per second, at `time` (with its delay
 * removed). Analytical where the generator provides it (springs).
 */
export function trackVelocity(track: Track<any>, time: number) {
    return calcGeneratorVelocity(track.generator, time, track.options.velocity)
}

/**
 * When a track moves, in ms from when it started: after its delay, and
 * until its total duration.
 */
export const trackEnd = (track: Track<any>) =>
    (track.options.delay || 0) + track.totalDuration
