import {
    easingDefinitionToFunction,
    isEasingArray,
    MotionGlobalConfig,
    secondsToMilliseconds,
} from "motion-utils"
import { frame } from "../../frameloop"
import {
    motionValue as createMotionValue,
    type MotionValue,
    type StartAnimation,
} from "../../value"
import { isMotionValue } from "../../value/utils/is-motion-value"
import { MultiValueAnimation, ValueTrack } from "../MultiValueAnimation"
import { getFinalKeyframe } from "../keyframes/get-final"
import { KeyframeResolver as DefaultKeyframeResolver } from "../keyframes/KeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import { fillWildcards } from "../keyframes/utils/fill-wildcards"
import {
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    UnresolvedValueKeyframe,
    ValueAnimationOptions,
    ValueAnimationTransition,
} from "../types"
import { canAnimate } from "../utils/can-animate"
import { getDefaultTransition } from "../utils/default-transitions"
import { getValueTransition } from "../utils/get-value-transition"
import { isTransitionDefined } from "../utils/is-transition-defined"
import { makeAnimationInstant } from "../utils/make-animation-instant"
import { fillAnimationDefaults } from "../utils/resolved-options"
import { supportsBrowserAnimation } from "../waapi/supports/waapi"
import { isGenerator } from "../generators/utils/is-generator"
import { replaceTransitionType } from "../utils/replace-transition-type"
import { replaceStringEasing } from "../waapi/utils/unsupported-easing"
import { mapEasingToNativeEasing } from "../waapi/easing/map-easing"
import { keyframes as keyframesType } from "../generators/keyframes"
import { spring } from "../generators/spring"
import { canGroupTransform } from "../waapi/transforms/TransformAnimation"

/**
 * What every value of one key in a call animates with, worked out once
 * for the call rather than once per value. Only the keyframes, delay and
 * velocity differ between them.
 */
export interface ValuePlan {
    /**
     * The value transition this plan was made from.
     */
    transition: any
    /**
     * Options shared by each value's track.
     */
    base: ValueAnimationOptions<any>
    /**
     * The easing as a function, for values that play on the shared animation.
     */
    ease?: unknown
    isInstant: boolean
    isSkipped: boolean
    isLong: boolean
    target?: unknown
    /**
     * The WAAPI timing and keyframe easing its values pool on WAAPI with,
     * or false if they can't.
     */
    waapi?: [KeyframeAnimationOptions, string[] | undefined] | false
}

/**
 * The shared animation one animate() call's values share, made by its first value,
 * and the plans its keys animate with.
 */
export interface MultiValueRef {
    animation?: MultiValueAnimation
    plans?: Record<string, ValuePlan>
    /**
     * Each spring's easing, shared by the values with its options.
     */
    springs?: Record<string, object>
}

/**
 * Value transitions differ between subjects by a stagger's delay, or a
 * sequence's times, so a plan is reused for a transition with the same
 * options otherwise.
 */
function isSameTransition(a: any, b: any) {
    if (a === b) return true
    let n = 0
    for (const key in a) {
        if (key !== "delay" && key !== "times" && !isSame(a[key], b[key])) {
            return false
        }
        n++
    }
    for (const _ in b) n--
    return n === 0
}

/**
 * Sequences make new easing arrays for each value.
 */
function isSame(a: any, b: any) {
    if (a === b) return true
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
        return false
    }
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
}

function makePlan(
    name: string,
    transition: any,
    keyframes: any[],
    element: AnimationElement | undefined
): ValuePlan {
    const base: any = {
        ease: "easeOut",
        ...transition,
        name,
        element,
        hasOnUpdate: !!transition.onUpdate,
    }
    base.onUpdate = base.onComplete = base.velocity = undefined

    /**
     * Without a transition for this value, it's given one for its kind.
     */
    if (!isTransitionDefined(transition)) {
        Object.assign(base, getDefaultTransition(name, { keyframes } as any))
    }

    base.duration &&= secondsToMilliseconds(base.duration)
    base.repeatDelay &&= secondsToMilliseconds(base.repeatDelay)

    let isInstant = false
    if (base.type === false || (base.duration === 0 && !base.repeatDelay)) {
        makeAnimationInstant(base)
        isInstant = true
    }

    const isSkipped = Boolean(
        MotionGlobalConfig.instantAnimations ||
            MotionGlobalConfig.skipAnimations ||
            element?.shouldSkipAnimations ||
            transition.skipAnimations
    )
    isSkipped && makeAnimationInstant(base)

    base.allowFlatten = !transition.type && !transition.ease
    fillAnimationDefaults(base)

    return {
        transition,
        base,
        isInstant,
        isSkipped,
        isLong: keyframes.length > 2,
        target: keyframes[1],
    }
}

/**
 * The plan's easing as a function, made once for its values on the shared animation.
 */
function planEase(plan: ValuePlan) {
    if (!("ease" in plan)) {
        const { ease } = plan.base
        plan.ease =
            typeof ease === "function" || isEasingArray(ease)
                ? ease
                : easingDefinitionToFunction(ease as any)
    }
    return plan.ease
}

function getPlan(
    ref: MultiValueRef,
    name: string,
    transition: any,
    keyframes: any[],
    element: AnimationElement | undefined
) {
    const plans = (ref.plans ||= {})
    let plan = plans[name]

    if (
        !plan ||
        !isSameTransition(plan.transition, transition) ||
        plan.isLong !== keyframes.length > 2 ||
        (plan.target !== keyframes[1] &&
            (plan.target === 0 || keyframes[1] === 0)) ||
        plan.base.element?.shouldSkipAnimations !==
            element?.shouldSkipAnimations
    ) {
        plan = plans[name] = makePlan(name, transition, keyframes, element)
    }

    return plan
}

/**
 * Without a subject to read, the origin is the value's own, as the
 * default keyframe resolver reads it, without making one.
 */
/**
 * WAAPI timing and keyframe easing for a value. A tween's is made once
 * for its plan. A generator's depends on the value's own keyframes and
 * velocity.
 */
function waapiTiming(options: any, ease: any) {
    const { type, repeat = 0, repeatType, pseudoElement } = options
    let { duration = 300 } = options

    if (isGenerator(type)) {
        ;({ duration, ease } = type.applyToOptions!({ ...options }))
    } else if (type !== keyframesType) {
        return false
    }

    const transition = { ease }
    replaceStringEasing(transition)
    const easing = mapEasingToNativeEasing(transition.ease as any, duration)
    const isArray = Array.isArray(easing)

    return [
        {
            duration,
            easing: isArray ? "linear" : easing,
            fill: "both",
            iterations: repeat + 1,
            direction: repeatType === "reverse" ? "alternate" : "normal",
            pseudoElement,
        },
        isArray ? easing : undefined,
    ] as [KeyframeAnimationOptions, string[] | undefined]
}

function resolveNow(target: any[], value: MotionValue) {
    const keyframes = [...target]

    if (keyframes[0] === null) {
        const current = value.get()
        keyframes[0] = current ?? keyframes[keyframes.length - 1]
        current === undefined && value.setCurrent(keyframes[0])
    }

    fillWildcards(keyframes)
    return keyframes
}

function resolve(
    track: ValueTrack,
    parent: MultiValueAnimation,
    value: MotionValue,
    element: AnimationElement | undefined
) {
    const { options } = track

    const onResolved = (keyframes: any[], finalKeyframe?: any) => {
        const { name, type, velocity, delay } = options

        /**
         * A value that can't animate between these keyframes is set to
         * its target.
         */
        const canAnimateValue = canAnimate(keyframes, name, type, velocity)
        if (!canAnimateValue) {
            if (MotionGlobalConfig.instantAnimations || !delay) {
                track.update(
                    getFinalKeyframe(keyframes, options, finalKeyframe)
                )
            }
            keyframes[0] = keyframes[keyframes.length - 1]
            makeAnimationInstant(options)
            options.repeat = 0
        }

        ;(options as any).finalKeyframe = finalKeyframe
        options.keyframes = keyframes

        if (
            element &&
            canAnimateValue &&
            supportsBrowserAnimation(options as any)
        ) {
            replaceTransitionType(options)
            const { plan } = track
            const timing =
                options.type === keyframesType
                    ? (plan.waapi ??= waapiTiming(options, plan.base.ease))
                    : waapiTiming(options, undefined)

            if (track.isStopped || (parent as any).isStopped) return
            if (timing) {
                try {
                    return parent.pool(
                        track,
                        options.motionValue!.owner!.current as Element,
                        timing
                    )
                } catch {}
            }
        }

        track.init()
    }

    const KeyframeResolver =
        element && (element.KeyframeResolver || DefaultKeyframeResolver)

    if (KeyframeResolver) {
        const resolver = new KeyframeResolver(
            options.keyframes,
            onResolved,
            options.name,
            value,
            element as any
        )
        track.resolver = resolver
        resolver.scheduleResolve()
    } else {
        onResolved(resolveNow(options.keyframes, value))
    }
}

/**
 * Start a value's animation on the call's shared animation, or on an animation of its
 * own when it can't share it.
 */
export const startValue =
    <V extends AnyResolvedKeyframe>(
        ref: MultiValueRef,
        name: string,
        value: MotionValue<V>,
        target: any,
        transition: any,
        element?: AnimationElement,
        repaints?: boolean
    ): StartAnimation =>
    (onComplete) => {
        const valueTransition = getValueTransition(transition, name) || {}
        const keyframes = Array.isArray(target) ? target : [null, target]
        const plan = getPlan(ref, name, valueTransition, keyframes, element)
        const { base } = plan

        /**
         * Delay inherits from the root transition, unlike the rest.
         */
        const delay = plan.isSkipped
            ? 0
            : -(
                  (transition.elapsed || 0) -
                  secondsToMilliseconds(
                      valueTransition.delay || transition.delay || 0
                  )
              )

        /**
         * Support deprecated way to set initial value. Prefer keyframe
         * syntax.
         */
        if (base.from !== undefined) keyframes[0] = base.from

        /**
         * Set straight to the target, without an animation.
         */
        if (
            (plan.isSkipped || (plan.isInstant && !delay)) &&
            value.get() !== undefined
        ) {
            const finalKeyframe = getFinalKeyframe(keyframes, valueTransition)

            if (finalKeyframe !== undefined) {
                frame.update(() => {
                    value.set(finalKeyframe)
                    valueTransition.onUpdate?.(finalKeyframe)
                    onComplete()
                    valueTransition.onComplete?.()
                })
                return
            }
        }

        const velocity =
            "velocity" in valueTransition
                ? valueTransition.velocity
                : value.getVelocity()

        /**
         * Transforms on an HTML element join its transform group.
         */
        const isTransform = canGroupTransform({
            name,
            motionValue: value,
        } as any)
        const parent = (ref.animation ||= new MultiValueAnimation(base.driver))
        if (base.autoplay === false) parent.options.autoplay = false

        const options: ValueAnimationOptions<any> = {
            ...base,
            element,
            ease: isTransform ? base.ease : (planEase(plan) as any),
            keyframes,
            times: valueTransition.times,
            delay,
            velocity,
            motionValue: value,
        }

        if (isTransform) {
            /**
             * Its element repaints every frame for another value of this
             * call, so, as with onUpdate, the transforms stay on the main
             * thread.
             */
            if (repaints) options.hasOnUpdate = true

            /**
             * A spring from rest has the same curve for every value with
             * its options. As one easing, an element's transforms compose
             * into two keyframes rather than many sampled ones, which the
             * browser parses slowly.
             */
            const { type } = options as any
            if ((type === "spring" || type === spring) && !velocity) {
                const {
                    stiffness,
                    damping,
                    mass,
                    duration,
                    bounce,
                    visualDuration,
                    restDelta,
                    restSpeed,
                } = options as any
                const id =
                    [
                        stiffness,
                        damping,
                        mass,
                        duration,
                        bounce,
                        visualDuration,
                        restDelta,
                        restSpeed,
                    ] + ""
                const springs = (ref.springs ||= {})
                if (!springs[id]) {
                    const { ease, duration } = spring.applyToOptions({
                        ...options,
                    })
                    springs[id] = { ease, duration, type: keyframesType }
                }
                Object.assign(options, springs[id])
            }
        }

        const track = parent.add(options, value, plan, onComplete)
        track.isTransform = isTransform

        resolve(track, parent, value, element)

        return track
    }

/**
 * Animate one value, or a number, from a plan like any other value.
 */
export function animateOneValue<V extends AnyResolvedKeyframe>(
    value: MotionValue<V> | V,
    keyframes: V | UnresolvedValueKeyframe<V>[],
    options: ValueAnimationTransition = {}
): AnimationPlaybackControlsWithThen {
    const motionValue = isMotionValue(value) ? value : createMotionValue(value)
    const ref: MultiValueRef = {}
    motionValue.run(startValue(ref, "", motionValue, keyframes, options))
    ref.animation?.start()
    return motionValue.animation as AnimationPlaybackControlsWithThen
}
