import { MotionGlobalConfig, secondsToMilliseconds } from "motion-utils"
import { AsyncMotionValueAnimation } from "../AsyncMotionValueAnimation"
import { JSAnimation } from "../JSAnimation"
import {
    canGroupTransform,
    TransformAnimation,
} from "../waapi/transforms/TransformAnimation"
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

/**
 * The options a value animates with, from its transition. Returns nothing
 * when the value is set to its target instead, without an animation.
 */
export function valueAnimationOptions<V extends AnyResolvedKeyframe>(
    name: string,
    value: MotionValue<V>,
    target: V | UnresolvedKeyframes<V>,
    transition: ValueTransition & { elapsed?: number },
    element: AnimationElement | undefined,
    isHandoff: boolean | undefined,
    onComplete: VoidFunction,
    valueTransition: any = getValueTransition(transition, name) || {}
): ValueAnimationOptions<V> | undefined {
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

    const options: ValueAnimationOptions<any> = {
        keyframes: Array.isArray(target) ? target : [null, target],
        ease: "easeOut",
        velocity: value.getVelocity(),
        ...valueTransition,
        delay: -elapsed,
        onUpdate: (v) => {
            value.set(v)
            valueTransition.onUpdate && valueTransition.onUpdate(v)
        },
        onComplete: () => {
            onComplete()
            valueTransition.onComplete && valueTransition.onComplete()
        },
        name,
        motionValue: value,
        element: isHandoff ? undefined : element,
        hasOnUpdate: !!valueTransition.onUpdate,
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
    if (shouldSkip && !isHandoff && value.get() !== undefined) {
        const finalKeyframe = getFinalKeyframe<V>(
            options.keyframes as V[],
            valueTransition
        )

        if (finalKeyframe !== undefined) {
            frame.update(() => {
                options.onUpdate!(finalKeyframe)
                options.onComplete!()
            })

            return
        }
    }

    return options
}

/**
 * Independent transforms on an HTML element never run as their own
 * WAAPI animation, so they're known to join a transform group before
 * their keyframes resolve, and resolve them themselves.
 */

export const animateMotionValue =
    <V extends AnyResolvedKeyframe>(
        name: string,
        value: MotionValue<V>,
        target: V | UnresolvedKeyframes<V>,
        transition: ValueTransition & { elapsed?: number } = {},
        element?: AnimationElement,
        isHandoff?: boolean
    ): StartAnimation =>
    (onComplete) => {
        const options = valueAnimationOptions(
            name,
            value,
            target,
            transition,
            element,
            isHandoff,
            onComplete
        )

        if (!options) return

        return createAnimation(options)
    }

/**
 * The animation a value runs once it has its options: JS straight away
 * when it's sync, in its element's transform group, or once its keyframes
 * are resolved.
 */
export const createAnimation = (options: ValueAnimationOptions<any>) =>
    (options as { isSync?: boolean }).isSync
        ? new JSAnimation(options)
        : canGroupTransform(options)
        ? new TransformAnimation(options)
        : new AsyncMotionValueAnimation(options)
