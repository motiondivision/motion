import { MotionGlobalConfig, secondsToMilliseconds } from "motion-utils"
import { AsyncMotionValueAnimation } from "../AsyncMotionValueAnimation"
import { JSAnimation } from "../JSAnimation"
import type {
    AnyResolvedKeyframe,
    ValueAnimationOptions,
    ValueTransition,
} from "../types"
import type { UnresolvedKeyframes } from "../keyframes/KeyframesResolver"
import { getValueTransition } from "../utils/get-value-transition"
import { makeAnimationInstant } from "../utils/make-animation-instant"
import { getDefaultTransition } from "../utils/default-transitions"
import { getFinalKeyframe } from "../keyframes/get-final"
import { isTransitionDefined } from "../utils/is-transition-defined"
import { frame } from "../../frameloop"
import type { MotionValue, StartAnimation } from "../../value"
import type { AnimationElement } from "../keyframes/types"
import type { Pool } from "../pool/Pool"

type MotionValueTransition = ValueTransition & { elapsed?: number }

/**
 * Turn a value's target and transition into animation options. `onUpdate`
 * and `onComplete` are the transition's own callbacks; the animation
 * writing the value is responsible for setting it.
 */
function resolveValueAnimation<V extends AnyResolvedKeyframe>(
    name: string,
    value: MotionValue<V>,
    target: V | UnresolvedKeyframes<V>,
    transition: MotionValueTransition,
    element?: AnimationElement,
    isHandoff?: boolean
) {
    const valueTransition = getValueTransition(transition, name) || {}

    /**
     * Most transition values are currently completely overwritten by value-specific
     * transitions. In the future it'd be nicer to blend these transitions. But for now
     * delay actually does inherit from the root transition if not value-specific.
     */
    const delay = valueTransition.delay || transition.delay || 0

    /**
     * Elapsed isn't a public transition option but can be passed through from
     * optimized appear effects in milliseconds.
     */
    let { elapsed = 0 } = transition
    elapsed = elapsed - secondsToMilliseconds(delay)

    const options: ValueAnimationOptions = {
        keyframes: Array.isArray(target) ? target : [null, target],
        ease: "easeOut",
        velocity: value.getVelocity(),
        ...valueTransition,
        delay: -elapsed,
        name,
        motionValue: value,
        element: isHandoff ? undefined : element,
    }

    /**
     * If there's no transition defined for this value, we can generate
     * unique transition settings for this value.
     */
    if (!isTransitionDefined(valueTransition)) {
        Object.assign(options, getDefaultTransition(name, options))
    }

    /**
     * Both WAAPI and our internal animation functions use durations
     * as defined by milliseconds, while our external API defines them
     * as seconds.
     */
    options.duration &&= secondsToMilliseconds(options.duration)
    options.repeatDelay &&= secondsToMilliseconds(options.repeatDelay)

    /**
     * Support deprecated way to set initial value. Prefer keyframe syntax.
     */
    if (options.from !== undefined) {
        options.keyframes[0] = options.from as any
    }

    let shouldSkip = false

    if (
        (options as any).type === false ||
        (options.duration === 0 && !options.repeatDelay)
    ) {
        makeAnimationInstant(options)

        if (options.delay === 0) {
            shouldSkip = true
        }
    }

    if (
        MotionGlobalConfig.instantAnimations ||
        MotionGlobalConfig.skipAnimations ||
        element?.shouldSkipAnimations ||
        valueTransition.skipAnimations
    ) {
        shouldSkip = true
        makeAnimationInstant(options)
        options.delay = 0
    }

    /**
     * If the transition type or easing has been explicitly set by the user
     * then we don't want to allow flattening the animation.
     */
    options.allowFlatten = !valueTransition.type && !valueTransition.ease

    /**
     * If we can or must skip creating the animation, and apply only
     * the final keyframe, do so. We also check once keyframes are resolved but
     * this early check prevents the need to create an animation at all.
     */
    const skipTo =
        shouldSkip && !isHandoff && value.get() !== undefined
            ? getFinalKeyframe<V>(options.keyframes as V[], valueTransition)
            : undefined

    return { options, valueTransition, skipTo }
}

export const animateMotionValue =
    <V extends AnyResolvedKeyframe>(
        name: string,
        value: MotionValue<V>,
        target: V | UnresolvedKeyframes<V>,
        transition: MotionValueTransition = {},
        element?: AnimationElement,
        isHandoff?: boolean
    ): StartAnimation =>
    (onComplete) => {
        const { options, valueTransition, skipTo } = resolveValueAnimation(
            name,
            value,
            target,
            transition,
            element,
            isHandoff
        )

        const { onUpdate, onComplete: onValueComplete } = options

        options.onUpdate = (v) => {
            value.set(v)
            onUpdate?.(v)
        }

        options.onComplete = () => {
            onComplete()
            onValueComplete?.()
        }

        if (skipTo !== undefined) {
            frame.update(() => {
                options.onUpdate!(skipTo)
                options.onComplete!()
            })

            return
        }

        return valueTransition.isSync
            ? new JSAnimation(options)
            : new AsyncMotionValueAnimation(options)
    }

/**
 * Start animating a value as part of a pool. Sync animations still run on
 * their own, as they must tick in the same frame they start, so this
 * returns one if created.
 */
export function animateInPool<V extends AnyResolvedKeyframe>(
    pool: Pool,
    name: string,
    value: MotionValue<V>,
    target: V | UnresolvedKeyframes<V>,
    transition: MotionValueTransition = {},
    element?: AnimationElement,
    isHandoff?: boolean
): JSAnimation<V> | undefined {
    let standalone: JSAnimation<V> | undefined

    value.start((onComplete) => {
        const { options, valueTransition, skipTo } = resolveValueAnimation(
            name,
            value,
            target,
            transition,
            element,
            isHandoff
        )

        if (skipTo !== undefined) {
            frame.update(() => {
                value.set(skipTo)
                options.onUpdate?.(skipTo)
                onComplete()
                options.onComplete?.()
            })

            return
        }

        if (valueTransition.isSync) {
            const { onUpdate, onComplete: onValueComplete } = options
            options.onUpdate = (v) => {
                value.set(v)
                onUpdate?.(v)
            }
            options.onComplete = () => {
                onComplete()
                onValueComplete?.()
            }
            return (standalone = new JSAnimation(options as any))
        }

        return pool.add(name, value, options as any, onComplete)
    })

    return standalone
}
