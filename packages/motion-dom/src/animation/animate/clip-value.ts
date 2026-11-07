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
import { createAnimation } from "../interfaces/motion-value"
import { getFinalKeyframe } from "../keyframes/get-final"
import { KeyframeResolver as DefaultKeyframeResolver } from "../keyframes/KeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import { fillWildcards } from "../keyframes/utils/fill-wildcards"
import { NativeAnimationExtended } from "../NativeAnimationExtended"
import { AnyResolvedKeyframe, ValueAnimationOptions } from "../types"
import { canAnimate } from "../utils/can-animate"
import { getDefaultTransition } from "../utils/default-transitions"
import { getValueTransition } from "../utils/get-value-transition"
import { isTransitionDefined } from "../utils/is-transition-defined"
import { makeAnimationInstant } from "../utils/make-animation-instant"
import { fillAnimationDefaults } from "../utils/resolved-options"
import { resolveStartTime } from "../utils/resolve-start-time"
import {
    colorProperties,
    supportsBrowserAnimation,
    supportsWaapi,
} from "../waapi/supports/waapi"
import { canGroupTransform } from "../waapi/transforms/TransformAnimation"
import { acceleratedValues } from "../waapi/utils/accelerated-values"

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
    canClip: boolean
}

/**
 * The clip one animate() call's values share, made by its first value,
 * and the plans its keys animate with.
 */
export interface ClipRef {
    clip?: Clip
    plans?: Record<string, ClipPlan>
}

/**
 * Value transitions differ between subjects only by a stagger's delay,
 * so a plan is reused for a transition with the same options otherwise.
 */
function isSameTransition(a: any, b: any) {
    if (a === b) return true
    let n = 0
    for (const key in a) {
        if (key !== "delay" && a[key] !== b[key]) return false
        n++
    }
    for (const _ in b) n--
    return n === 0
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
    delete base.onUpdate
    delete base.onComplete
    delete base.velocity

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

    const { onPlay, onStop, onCancel, ease } = base

    return {
        transition,
        base,
        ease:
            typeof ease === "function" || isEasingArray(ease)
                ? ease
                : easingDefinitionToFunction(ease),
        isInstant,
        isSkipped,
        isLong: keyframes.length > 2,
        target: keyframes[1],
        /**
         * A DOM value WAAPI might run is left to the animation that
         * decides once its keyframes are read.
         */
        canClip:
            !onPlay &&
            !onStop &&
            !onCancel &&
            !(element && acceleratedValues.has(name) && supportsWaapi()),
    }
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
 * A color with a keyframe only the browser can blend is played by WAAPI,
 * once the origin has been read.
 */
function startNative(track: ClipTrack, clip: Clip) {
    const { options } = track
    const native = new NativeAnimationExtended({
        ...(options as any),
        ease: track.plan.base.ease,
        onUpdate: (v: any) => track.update(v),
        onComplete: () => track.finish(),
        element: options.motionValue?.owner?.current,
        startTime:
            clip.startTime === null
                ? undefined
                : resolveStartTime(clip.startTime, time.now()),
    })
    clip.state === "paused" && native.pause()
    return native
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
        if (!canAnimate(keyframes, name, type, velocity)) {
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
            colorProperties.has(name!) &&
            supportsBrowserAnimation(options as any)
        ) {
            clip.detach(track, startNative(track, clip))
        } else {
            track.init()
        }
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
        /**
         * Without a subject to read, the origin is the value's own, as the
         * default keyframe resolver reads it, without making one.
         */
        const keyframes = [...options.keyframes]

        if (keyframes[0] === null) {
            const current = value.get()
            keyframes[0] = current ?? keyframes[keyframes.length - 1]
            current === undefined && value.setCurrent(keyframes[0])
        }

        fillWildcards(keyframes)
        onResolved(keyframes)
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
        element?: AnimationElement
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

        if (
            !plan.canClip ||
            (ref.clip && ref.clip.options.driver !== base.driver) ||
            canGroupTransform({ name, motionValue: value } as any)
        ) {
            return createAnimation({
                ...base,
                keyframes,
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
            })
        }

        const clip = (ref.clip ||= new Clip(base.driver))
        if (base.autoplay === false) clip.options.autoplay = false

        const track = clip.add(
            {
                ...base,
                ease: plan.ease as any,
                keyframes,
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
