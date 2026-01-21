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
import { getFinalKeyframe } from "../utils/get-final-keyframe"
import { isTransitionDefined } from "../utils/is-transition-defined"
import { resolveTransitionValue } from "../utils/resolve-transition-value"
import { frame } from "../../frameloop"
import type { MotionValue, StartAnimation } from "../../value"
import type { VisualElement } from "../../render/VisualElement"

export const animateMotionValue =
    <V extends AnyResolvedKeyframe>(
        name: string,
        value: MotionValue<V>,
        target: V | UnresolvedKeyframes<V>,
        transition: ValueTransition & { elapsed?: number } = {},
        element?: VisualElement<any>,
        isHandoff?: boolean
    ): StartAnimation =>
    (onComplete) => {
        const valueTransition = getValueTransition(transition, name) || {}

        /**
         * Most transition values are currently completely overwritten by value-specific
         * transitions. In the future it'd be nicer to blend these transitions. But for now
         * delay actually does inherit from the root transition if not value-specific.
         */
        const rawDelay = valueTransition.delay ?? transition.delay ?? 0

        /**
         * Get the DOM element for CSS variable resolution.
         * If not available, we'll fall back to numeric-only resolution.
         */
        const domElement = element?.current as Element | undefined

        /**
         * Resolve delay, handling CSS variables and time strings.
         * The resolved value is in milliseconds.
         */
        const delayMs = domElement && typeof rawDelay === "string"
            ? resolveTransitionValue(rawDelay, domElement, 0)
            : typeof rawDelay === "number"
                ? secondsToMilliseconds(rawDelay)
                : 0

        /**
         * Elapsed isn't a public transition option but can be passed through from
         * optimized appear effects in milliseconds.
         */
        let { elapsed = 0 } = transition
        elapsed = elapsed - delayMs

        const options: ValueAnimationOptions = {
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
         * as seconds. CSS variables and time strings are also supported.
         */
        if (options.duration !== undefined) {
            options.duration = domElement && typeof options.duration === "string"
                ? resolveTransitionValue(options.duration, domElement, 300)
                : typeof options.duration === "number"
                    ? secondsToMilliseconds(options.duration)
                    : 300
        }
        if (options.repeatDelay !== undefined) {
            options.repeatDelay = domElement && typeof options.repeatDelay === "string"
                ? resolveTransitionValue(options.repeatDelay, domElement, 0)
                : typeof options.repeatDelay === "number"
                    ? secondsToMilliseconds(options.repeatDelay)
                    : 0
        }

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
            MotionGlobalConfig.skipAnimations
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

        return valueTransition.isSync
            ? new JSAnimation(options)
            : new AsyncMotionValueAnimation(options)
    }
