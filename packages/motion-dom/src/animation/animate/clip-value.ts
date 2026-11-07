import {
    easingDefinitionToFunction,
    isEasingArray,
    MotionGlobalConfig,
    secondsToMilliseconds,
} from "motion-utils"
import { frame } from "../../frameloop"
import { time } from "../../frameloop/sync-time"
import type { MotionValue, StartAnimation } from "../../value"
import { Clip, ClipTrack } from "../Clip"
import { JSAnimation } from "../JSAnimation"
import { getFinalKeyframe } from "../keyframes/get-final"
import { KeyframeResolver as DefaultKeyframeResolver } from "../keyframes/KeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import { fillWildcards } from "../keyframes/utils/fill-wildcards"
import { NativeAnimationExtended } from "../NativeAnimationExtended"
import {
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    ValueAnimationOptions,
} from "../types"
import { canAnimate } from "../utils/can-animate"
import { getDefaultTransition } from "../utils/default-transitions"
import { getValueTransition } from "../utils/get-value-transition"
import { isTransitionDefined } from "../utils/is-transition-defined"
import { makeAnimationInstant } from "../utils/make-animation-instant"
import {
    applyResolvedKeyframes,
    fillAnimationDefaults,
} from "../utils/resolved-options"
import { resolveStartTime } from "../utils/resolve-start-time"
import { supportsBrowserAnimation } from "../waapi/supports/waapi"
import { acceleratedValues } from "../waapi/utils/accelerated-values"
import { replaceStringEasing } from "../waapi/utils/unsupported-easing"
import { mapEasingToNativeEasing } from "../waapi/easing/map-easing"
import { keyframes as keyframesType } from "../generators/keyframes"
import {
    canGroupTransform,
    TransformAnimation,
} from "../waapi/transforms/TransformAnimation"

/**
 * What every value of one key in a call animates with, worked out once
 * for the call rather than once per value. Only the keyframes, delay and
 * velocity differ between them.
 */
export interface ClipPlan {
    /**
     * The value transition this plan was made from.
     */
    transition: any
    /**
     * Options shared by each value's track.
     */
    base: ValueAnimationOptions<any>
    /**
     * The easing as a function, for values that play on the clip.
     */
    ease?: unknown
    isInstant: boolean
    isSkipped: boolean
    isLong: boolean
    target?: unknown
    /**
     * Its values play on an animation of their own, as the clip doesn't
     * call onPlay, onStop or onCancel.
     */
    isOwn: boolean
    /**
     * The WAAPI timing and keyframe easing its values pool on WAAPI with,
     * or false if they can't.
     */
    waapi?: [KeyframeAnimationOptions, string[] | undefined] | false
}

/**
 * The clip one animate() call's values share, made by its first value,
 * and the plans its keys animate with.
 */
export interface ClipRef {
    clip?: Clip
    plans?: Record<string, ClipPlan>
    /**
     * A lone value, which plays on a JSAnimation rather than a clip.
     */
    isOne?: boolean
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
): ClipPlan {
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
        isOwn: !!(base.onPlay || base.onStop || base.onCancel),
    }
}

/**
 * The plan's easing as a function, made once for its values on the clip.
 */
function clipEase(plan: ClipPlan) {
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
    ref: ClipRef,
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
 * Play a value on an animation of its own, at the clip's clock: WAAPI for
 * one the browser can run, once its origin is read, otherwise JS.
 */
function startOwn(
    track: ClipTrack,
    clip: Clip,
    Animation: new (options: any) => AnimationPlaybackControlsWithThen
) {
    const { options } = track
    const animation = new Animation({
        ...options,
        ease: track.plan.base.ease,
        onUpdate: (v: any) => track.update(v),
        onComplete: () => track.finish(),
        element: options.motionValue?.owner?.current,
        startTime:
            clip.startTime === null
                ? undefined
                : resolveStartTime(clip.startTime, time.now()),
    })
    clip.state === "paused" && animation.pause()
    clip.detach(track, animation)
}

/**
 * Without a subject to read, the origin is the value's own, as the
 * default keyframe resolver reads it, without making one.
 */
/**
 * WAAPI timing for a plan's values, made once for them all. Tweens only,
 * as a spring's timing depends on each value's keyframes and velocity.
 */
function waapiTiming({ base }: { base: any }) {
    const { type, duration = 300, repeat = 0, repeatType, pseudoElement } =
        base
    if (type !== "keyframes" && type !== "tween" && type !== keyframesType) {
        return false
    }
    const transition = { ease: base.ease }
    replaceStringEasing(transition)
    const easing = mapEasingToNativeEasing(transition.ease as any, duration)
    const isArray = Array.isArray(easing)
    return pseudoElement
        ? false
        : ([
              {
                  duration,
                  easing: isArray ? "linear" : easing,
                  fill: "both",
                  iterations: repeat + 1,
                  direction: repeatType === "reverse" ? "alternate" : "normal",
              },
              isArray ? easing : undefined,
          ] as [KeyframeAnimationOptions, string[] | undefined])
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
    track: ClipTrack,
    clip: Clip,
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
            const { plan } = track
            if (acceleratedValues.has(name!)) {
                plan.waapi ??= waapiTiming(plan)
                if (plan.waapi) {
                    track.init()
                    return (
                        track.isStopped ||
                        clip.pool(
                            track,
                            options.motionValue!.owner!.current as Element,
                            plan.waapi
                        )
                    )
                }
            }
            try {
                return startOwn(track, clip, NativeAnimationExtended)
            } catch {}
        }

        track.plan.isOwn || options.driver !== clip.options.driver
            ? startOwn(track, clip, JSAnimation)
            : track.init()
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
 * Start a value's animation on the call's clip, or on an animation of its
 * own when it can't share the clip.
 */
export const startValue =
    <V extends AnyResolvedKeyframe>(
        ref: ClipRef,
        name: string,
        value: MotionValue<V>,
        target: any,
        transition: any,
        element?: AnimationElement,
        isHandoff?: boolean
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
            !isHandoff &&
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
         * Transforms on an HTML element join its transform group. A lone
         * value has no clip to share, and one handed off from an optimised
         * appear animation runs in JS beneath it, from its start time.
         */
        const isTransform = canGroupTransform({ name, motionValue: value } as any)
        if (isTransform || ref.isOne || isHandoff) {
            const options: ValueAnimationOptions<any> = {
                ...base,
                element: isHandoff ? undefined : element,
                keyframes,
                times: valueTransition.times,
                delay,
                velocity,
                motionValue: value,
                onUpdate: (latest: any) => {
                    value.set(latest)
                    valueTransition.onUpdate?.(latest)
                },
                onComplete: () => {
                    onComplete()
                    valueTransition.onComplete?.()
                },
            }

            if (isTransform) return new TransformAnimation(options)

            applyResolvedKeyframes(options, resolveNow(keyframes, value), undefined)
            return new JSAnimation(options)
        }

        const clip = (ref.clip ||= new Clip(base.driver))
        if (base.autoplay === false) clip.options.autoplay = false

        const track = clip.add(
            {
                ...base,
                element,
                ease: clipEase(plan) as any,
                keyframes,
                times: valueTransition.times,
                delay,
                velocity,
                motionValue: value,
            },
            value,
            plan,
            onComplete
        )

        resolve(track, clip, value, element)

        return track
    }
