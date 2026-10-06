import { MotionGlobalConfig } from "motion-utils"
import { JSAnimation } from "../JSAnimation"
import { getFinalKeyframe } from "../keyframes/get-final"
import { ResolvedKeyframes } from "../keyframes/KeyframesResolver"
import { NativeAnimationExtended } from "../NativeAnimationExtended"
import {
    AnimationPlaybackControls,
    AnyResolvedKeyframe,
    ValueAnimationOptions,
} from "../types"
import { supportsBrowserAnimation } from "../waapi/supports/waapi"
import {
    canAccelerateTransform,
    canGroupTransform,
    TransformAnimation,
} from "../waapi/transforms/TransformAnimation"
import { canAnimate } from "./can-animate"
import { makeAnimationInstant } from "./make-animation-instant"
import { resolveStartTime } from "./resolve-start-time"

export type ResolvedOptions<T extends AnyResolvedKeyframe> =
    ValueAnimationOptions<T> & {
        startTime?: number
        finalKeyframe?: T
    }

/**
 * Start the animation of one value once its keyframes are resolved: on
 * WAAPI if the value can run there on its own, in its element's
 * transform group if it's an independent transform, otherwise in JS.
 *
 * `sync` is whether keyframes resolved without being forced, and
 * `createdAt` when the animation was asked for.
 */
export function startResolvedAnimation<T extends AnyResolvedKeyframe>(
    keyframes: ResolvedKeyframes<T>,
    finalKeyframe: T,
    options: ResolvedOptions<T>,
    sync: boolean,
    createdAt: number,
    resolvedAt: number
): AnimationPlaybackControls {
    const { name, type, velocity, delay, isHandoff, onUpdate } = options

    /**
     * If we can't animate this value with the resolved keyframes
     * then we should complete it immediately.
     */
    let canAnimateValue = true
    if (!canAnimate(keyframes, name, type, velocity)) {
        canAnimateValue = false

        if (MotionGlobalConfig.instantAnimations || !delay) {
            onUpdate?.(getFinalKeyframe(keyframes, options, finalKeyframe))
        }

        keyframes[0] = keyframes[keyframes.length - 1]

        makeAnimationInstant(options)
        options.repeat = 0
    }

    options.finalKeyframe = finalKeyframe
    options.keyframes = keyframes

    /**
     * Animate via WAAPI if possible. If this is a handoff animation, the optimised animation will be running via
     * WAAPI. Therefore, this animation must be JS to ensure it runs "under" the
     * optimised animation.
     *
     * Also skip WAAPI when keyframes aren't animatable, as the resolved
     * values may not be valid CSS and would trigger browser warnings.
     */
    const useWaapi =
        canAnimateValue && !isHandoff && supportsBrowserAnimation(options)

    /**
     * Independent transforms (x, scale etc) on an HTML element are
     * composed into one WAAPI transform animation per element.
     */
    const isGroupedTransform = !useWaapi && canGroupTransform(options)

    /**
     * Resolve startTime for the animation. A startTime passed in options
     * (an optimised appear handoff syncing to its WAAPI animation) takes
     * precedence.
     *
     * *Ideally*, we would use the createdAt time as t=0 as the following
     * frame would then be the first frame of the animation in progress,
     * which would feel snappier. If keyframes resolved on a later frame,
     * and long after creation, we start from then instead.
     *
     * If they resolved immediately, a JSAnimation picks its own start
     * time and resolves it the same way on its first frame, so every
     * animation started in that moment stays in sync. WAAPI has no frame
     * of ours to do that on.
     */
    if (
        sync &&
        (useWaapi || isGroupedTransform || resolvedAt !== createdAt)
    ) {
        options.startTime ??= resolveStartTime(createdAt, resolvedAt)
    }

    if (useWaapi) {
        /**
         * The resolver needed the VisualElement, WAAPI needs the DOM
         * element. JSAnimation reads neither, so this is safe to
         * leave in place if we fall back to it.
         */
        options.element = options.motionValue?.owner?.current as any
        try {
            return new NativeAnimationExtended(options as any)
        } catch {}
    } else if (isGroupedTransform) {
        return new TransformAnimation(
            options,
            !isHandoff && canAccelerateTransform(options)
        )
    }

    return new JSAnimation(options)
}
