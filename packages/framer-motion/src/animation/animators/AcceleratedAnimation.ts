import {
    attachTimeline,
    isGenerator,
    isWaapiSupportedEasing,
    supportsLinearEasing,
    ValueAnimationOptions,
} from "motion-dom"
import {
    millisecondsToSeconds,
    noop,
    secondsToMilliseconds,
} from "motion-utils"
import { anticipate } from "../../easing/anticipate"
import { backInOut } from "../../easing/back"
import { circInOut } from "../../easing/circ"
import { EasingDefinition } from "../../easing/types"
import { DOMKeyframesResolver } from "../../render/dom/DOMKeyframesResolver"
import { ResolvedKeyframes } from "../../render/utils/KeyframesResolver"
import { MotionValue } from "../../value"
import { ValueAnimationOptionsWithRenderContext } from "../types"
import {
    BaseAnimation,
    ValueAnimationOptionsWithDefaults,
} from "./BaseAnimation"
import { MainThreadAnimation } from "./MainThreadAnimation"
import { acceleratedValues } from "./utils/accelerated-values"
import { startWaapiAnimation } from "./waapi"
import { getFinalKeyframe } from "./waapi/utils/get-final-keyframe"
import { supportsWaapi } from "./waapi/utils/supports-waapi"

/**
 * 10ms is chosen here as it strikes a balance between smooth
 * results (more than one keyframe per frame at 60fps) and
 * keyframe quantity.
 */
const sampleDelta = 10 //ms

/**
 * Implement a practical max duration for keyframe generation
 * to prevent infinite loops
 */
const maxDuration = 20_000

/**
 * Check if an animation can run natively via WAAPI or requires pregenerated keyframes.
 * WAAPI doesn't support spring or function easings so we run these as JS animation before
 * handing off.
 */
function requiresPregeneratedKeyframes<T extends string | number>(
    options: ValueAnimationOptions<T>
) {
    return (
        isGenerator(options.type) ||
        options.type === "spring" ||
        !isWaapiSupportedEasing(options.ease)
    )
}

function pregenerateKeyframes<T extends string | number>(
    keyframes: ResolvedKeyframes<T>,
    options: ValueAnimationOptions<T>
) {
    /**
     * Create a main-thread animation to pregenerate keyframes.
     * We sample this at regular intervals to generate keyframes that we then
     * linearly interpolate between.
     */
    const sampleAnimation = new MainThreadAnimation({
        ...options,
        keyframes,
        repeat: 0,
        delay: 0,
        isGenerator: true,
    })

    let state = { done: false, value: keyframes[0] }
    const pregeneratedKeyframes: T[] = []

    /**
     * Bail after 20 seconds of pre-generated keyframes as it's likely
     * we're heading for an infinite loop.
     */
    let t = 0
    while (!state.done && t < maxDuration) {
        state = sampleAnimation.sample(t)
        pregeneratedKeyframes.push(state.value)
        t += sampleDelta
    }

    return {
        times: undefined,
        keyframes: pregeneratedKeyframes,
        duration: t - sampleDelta,
        ease: "linear" as EasingDefinition,
    }
}

export interface AcceleratedValueAnimationOptions<
    T extends string | number = number
> extends ValueAnimationOptions<T> {
    name: string
    motionValue: MotionValue<T>
}

interface ResolvedAcceleratedAnimation {
    animation: Animation
    duration: number
    times: ValueAnimationOptions["times"]
    type: ValueAnimationOptions["type"]
    ease: ValueAnimationOptions["ease"]
    keyframes: string[] | number[]
}

const unsupportedEasingFunctions = {
    anticipate,
    backInOut,
    circInOut,
}

function isUnsupportedEase(
    key: string
): key is keyof typeof unsupportedEasingFunctions {
    return key in unsupportedEasingFunctions
}

export class AcceleratedAnimation<
    T extends string | number
> extends BaseAnimation<T, ResolvedAcceleratedAnimation> {
    protected options: ValueAnimationOptionsWithDefaults<T> & {
        name: string
        motionValue: MotionValue<T>
    }

    constructor(options: ValueAnimationOptionsWithRenderContext<T>) {
        super(options)

        const { name, motionValue, element, keyframes } = this.options

        this.resolver = new DOMKeyframesResolver<T>(
            keyframes,
            (resolvedKeyframes: ResolvedKeyframes<T>, finalKeyframe: T) =>
                this.onKeyframesResolved(resolvedKeyframes, finalKeyframe),
            name,
            motionValue,
            element
        )

        this.resolver.scheduleResolve()
    }

    /**
     * An AnimationTimline to attach to the WAAPI animation once it's created.
     */
    private pendingTimeline: AnimationTimeline | undefined

    protected initPlayback(keyframes: ResolvedKeyframes<T>, finalKeyframe: T) {
        let {
            duration = 300,
            times,
            ease,
            type,
            motionValue,
            name,
            startTime,
        } = this.options

        /**
         * If element has since been unmounted, return false to indicate
         * the animation failed to initialised.
         */
        if (!motionValue.owner?.current) {
            return false
        }

        /**
         * If the user has provided an easing function name that isn't supported
         * by WAAPI (like "anticipate"), we need to provide the corressponding
         * function. This will later get converted to a linear() easing function.
         */
        if (
            typeof ease === "string" &&
            supportsLinearEasing() &&
            isUnsupportedEase(ease)
        ) {
            ease = unsupportedEasingFunctions[ease]
        }

        /**
         * If this animation needs pre-generated keyframes then generate.
         */
        if (requiresPregeneratedKeyframes(this.options)) {
            const { onComplete, onUpdate, motionValue, element, ...options } =
                this.options
            const pregeneratedAnimation = pregenerateKeyframes(
                keyframes,
                options
            )

            keyframes = pregeneratedAnimation.keyframes

            // If this is a very short animation, ensure we have
            // at least two keyframes to animate between as older browsers
            // can't animate between a single keyframe.
            if (keyframes.length === 1) {
                keyframes[1] = keyframes[0]
            }

            duration = pregeneratedAnimation.duration
            times = pregeneratedAnimation.times
            ease = pregeneratedAnimation.ease
            type = "keyframes"
        }

        const animation = startWaapiAnimation(
            motionValue.owner!.current as unknown as HTMLElement,
            name,
            keyframes as string[],
            { ...this.options, duration, times, ease }
        )

        // Override the browser calculated startTime with one synchronised to other JS
        // and WAAPI animations starting this event loop.
        animation.startTime = startTime ?? this.calcStartTime()

        if (this.pendingTimeline) {
            attachTimeline(animation, this.pendingTimeline)
            this.pendingTimeline = undefined
        } else {
            /**
             * Prefer the `onfinish` prop as it's more widely supported than
             * the `finished` promise.
             *
             * Here, we synchronously set the provided MotionValue to the end
             * keyframe. If we didn't, when the WAAPI animation is finished it would
             * be removed from the element which would then revert to its old styles.
             */
            animation.onfinish = () => {
                const { onComplete } = this.options
                motionValue.set(
                    getFinalKeyframe(keyframes, this.options, finalKeyframe)
                )
                onComplete && onComplete()
                this.cancel()
                this.resolveFinishedPromise()
            }
        }

        return {
            animation,
            duration,
            times,
            type,
            ease,
            keyframes: keyframes as string[] | number[],
        }
    }

    get duration() {
        const { resolved } = this
        if (!resolved) return 0
        const { duration } = resolved
        return millisecondsToSeconds(duration)
    }

    get time() {
        const { resolved } = this
        if (!resolved) return 0
        const { animation } = resolved
        return millisecondsToSeconds((animation.currentTime as number) || 0)
    }

    set time(newTime: number) {
        const { resolved } = this
        if (!resolved) return

        const { animation } = resolved
        animation.currentTime = secondsToMilliseconds(newTime)
    }

    get speed() {
        const { resolved } = this
        if (!resolved) return 1

        const { animation } = resolved
        return animation.playbackRate
    }

    set speed(newSpeed: number) {
        const { resolved } = this
        if (!resolved) return

        const { animation } = resolved
        animation.playbackRate = newSpeed
    }

    get state() {
        const { resolved } = this
        if (!resolved) return "idle"

        const { animation } = resolved
        return animation.playState
    }

    get startTime() {
        const { resolved } = this
        if (!resolved) return null

        const { animation } = resolved

        // Coerce to number as TypeScript incorrectly types this
        // as CSSNumberish
        return animation.startTime as number
    }

    /**
     * Replace the default DocumentTimeline with another AnimationTimeline.
     * Currently used for scroll animations.
     */
    attachTimeline(timeline: any) {
        if (!this._resolved) {
            this.pendingTimeline = timeline
        } else {
            const { resolved } = this
            if (!resolved) return noop<void>

            const { animation } = resolved
            attachTimeline(animation, timeline)
        }

        return noop<void>
    }

    play() {
        if (this.isStopped) return
        const { resolved } = this
        if (!resolved) return

        const { animation } = resolved

        if (animation.playState === "finished") {
            this.updateFinishedPromise()
        }

        animation.play()
    }

    pause() {
        const { resolved } = this
        if (!resolved) return

        const { animation } = resolved
        animation.pause()
    }

    stop() {
        this.resolver.cancel()
        this.isStopped = true
        if (this.state === "idle") return

        this.resolveFinishedPromise()
        this.updateFinishedPromise()

        const { resolved } = this
        if (!resolved) return

        const { animation, keyframes, duration, type, ease, times } = resolved

        if (
            animation.playState === "idle" ||
            animation.playState === "finished"
        ) {
            return
        }

        /**
         * WAAPI doesn't natively have any interruption capabilities.
         *
         * Rather than read commited styles back out of the DOM, we can
         * create a renderless JS animation and sample it twice to calculate
         * its current value, "previous" value, and therefore allow
         * Motion to calculate velocity for any subsequent animation.
         */
        if (this.time) {
            const { motionValue, onUpdate, onComplete, element, ...options } =
                this.options

            const sampleAnimation = new MainThreadAnimation({
                ...options,
                keyframes,
                duration,
                type,
                ease,
                times,
                isGenerator: true,
            })

            const sampleTime = secondsToMilliseconds(this.time)

            motionValue.setWithVelocity(
                sampleAnimation.sample(sampleTime - sampleDelta).value,
                sampleAnimation.sample(sampleTime).value,
                sampleDelta
            )
        }

        const { onStop } = this.options
        onStop && onStop()

        this.cancel()
    }

    complete() {
        const { resolved } = this
        if (!resolved) return
        resolved.animation.finish()
    }

    cancel() {
        const { resolved } = this
        if (!resolved) return
        resolved.animation.cancel()
    }

    static supports(
        options: ValueAnimationOptionsWithRenderContext
    ): options is AcceleratedValueAnimationOptions {
        const { motionValue, name, repeatDelay, repeatType, damping, type } =
            options

        return (
            supportsWaapi() &&
            name &&
            acceleratedValues.has(name) &&
            motionValue &&
            motionValue.owner &&
            motionValue.owner.current instanceof HTMLElement &&
            /**
             * If we're outputting values to onUpdate then we can't use WAAPI as there's
             * no way to read the value from WAAPI every frame.
             */
            !motionValue.owner.getProps().onUpdate &&
            !repeatDelay &&
            repeatType !== "mirror" &&
            damping !== 0 &&
            type !== "inertia"
        )
    }
}
