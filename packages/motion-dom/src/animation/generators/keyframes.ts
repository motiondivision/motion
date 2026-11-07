import {
    easeInOut,
    easingDefinitionToFunction,
    EasingFunction,
    isEasingArray,
    MotionGlobalConfig,
} from "motion-utils"
import { interpolate } from "../../utils/interpolate"
import { mix } from "../../utils/mix"
import { defaultOffset } from "../keyframes/offsets/default"
import { convertOffsetToTimes } from "../keyframes/offsets/time"
import {
    AnimationState,
    AnyResolvedKeyframe,
    KeyframeGenerator,
    Lane,
    ValueAnimationOptions,
} from "../types"

export function defaultEasing(
    values: any[],
    easing?: EasingFunction
): EasingFunction[] {
    return values.map(() => easing || easeInOut).splice(0, values.length - 1)
}

export function keyframes<T extends AnyResolvedKeyframe>({
    duration = 300,
    keyframes: keyframeValues,
    times,
    ease = "easeInOut",
    mixer: transitionMixer,
}: ValueAnimationOptions<T>): KeyframeGenerator<T> {
    /**
     * A mixer only blends values that aren't numbers. Numbers blend as
     * usual, as they do in springs, and so do the progress animations
     * behind layout and path animations, which take the same transition.
     */
    const customMixer =
        typeof keyframeValues[0] === "number" ? undefined : transitionMixer

    /**
     * Easing functions can be externally defined as strings. Here we convert them
     * into actual functions.
     */
    const easingFunctions = isEasingArray(ease)
        ? ease.map(easingDefinitionToFunction)
        : easingDefinitionToFunction(ease) || easeInOut

    /**
     * Two numbers, the most common animation, blend without a mixer,
     * offsets or closures.
     */
    if (
        keyframeValues.length === 2 &&
        !times &&
        typeof keyframeValues[0] === "number" &&
        typeof keyframeValues[1] === "number" &&
        typeof easingFunctions === "function" &&
        !MotionGlobalConfig.mix
    ) {
        return new NumberTween(
            keyframeValues[0],
            keyframeValues[1],
            duration,
            easingFunctions
        ) as unknown as KeyframeGenerator<T>
    }

    /**
     * This is the Iterator-spec return value. We ensure it's mutable rather than using a generator
     * to reduce GC during animation.
     */
    const state: AnimationState<T> = {
        done: false,
        value: keyframeValues[0],
    }

    /**
     * Two keyframes, or keyframes that hold, move once, then hold, as each
     * value of a sequence does, ease and mix only the pair that moves.
     */
    let span = -1
    if (!customMixer) {
        for (let i = 1; i < keyframeValues.length; i++) {
            if (keyframeValues[i] !== keyframeValues[i - 1]) {
                if (span >= 0) {
                    span = -2
                    break
                }
                span = i - 1
            }
        }
    }

    if (span >= 0) {
        const offsets =
            times && times.length === keyframeValues.length
                ? times
                : defaultOffset(keyframeValues)
        const from = offsets[span] * duration
        const to = offsets[span + 1] * duration
        const origin = keyframeValues[span]
        const target = keyframeValues[span + 1]
        const ease = Array.isArray(easingFunctions)
            ? easingFunctions[span]
            : easingFunctions
        const mixer = (MotionGlobalConfig.mix || mix)(origin, target)
        const last = keyframeValues.length - 2

        return {
            calculatedDuration: duration,
            lane:
                typeof origin === "number" &&
                typeof target === "number" &&
                !MotionGlobalConfig.mix &&
                to > from
                    ? {
                          from: origin,
                          delta: target - origin,
                          ease,
                          start: from,
                          end: to,
                      }
                    : undefined,
            next: (t: number) => {
                /**
                 * Held keyframes either side of the move are mixed as
                 * interpolate() mixes them, so colours keep its format.
                 */
                state.value =
                    span && t < from
                        ? mixer(0)
                        : span < last && (t >= to || !duration)
                        ? typeof target === "number"
                            ? target
                            : mixer(1)
                        : mixer(
                              ease(
                                  t >= to || !duration
                                      ? 1
                                      : t <= from
                                      ? 0
                                      : (t - from) / (to - from)
                              )
                          )
                state.done = t >= duration
                return state
            },
        }
    }

    /**
     * Create a times array based on the provided 0-1 offsets
     */
    const absoluteTimes = convertOffsetToTimes(
        // Only use the provided offsets if they're the correct length
        // TODO Maybe we should warn here if there's a length mismatch
        times && times.length === keyframeValues.length
            ? times
            : defaultOffset(keyframeValues),
        duration
    )

    const mapTimeToKeyframe = interpolate<T>(absoluteTimes, keyframeValues, {
        ease: Array.isArray(easingFunctions)
            ? easingFunctions
            : defaultEasing(keyframeValues, easingFunctions),
        mixer: customMixer,
    })

    return {
        calculatedDuration: duration,
        next: (t: number) => {
            state.value = mapTimeToKeyframe(t)
            state.done = t >= duration
            return state
        },
    }
}

/**
 * A tween between two numbers. It's its own lane: the blend from `from`
 * by `delta`, eased between `start` and `end`.
 */
class NumberTween implements KeyframeGenerator<number>, Lane {
    state: AnimationState<number>
    delta: number
    start = 0
    lane?: Lane

    constructor(
        public from: number,
        target: number,
        public calculatedDuration: number,
        public ease: EasingFunction
    ) {
        this.delta = target - from
        this.state = { done: false, value: from }
        if (calculatedDuration > 0) this.lane = this
    }

    get end() {
        return this.calculatedDuration
    }

    next(t: number) {
        const { calculatedDuration: duration, state } = this
        state.value =
            this.from +
            this.delta *
                this.ease(
                    t >= duration || !duration ? 1 : t <= 0 ? 0 : t / duration
                )
        state.done = t >= duration
        return state
    }

    toString() {
        return ""
    }
}
