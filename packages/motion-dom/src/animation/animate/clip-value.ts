import { Clip, ClipTrack } from "../Clip"
import {
    createAnimation,
    valueAnimationOptions,
} from "../interfaces/motion-value"
import {
    KeyframeResolver as DefaultKeyframeResolver,
    ResolvedKeyframes,
} from "../keyframes/KeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import { fillWildcards } from "../keyframes/utils/fill-wildcards"
import { AnyResolvedKeyframe, ValueAnimationOptions } from "../types"
import {
    applyResolvedKeyframes,
    fillAnimationDefaults,
} from "../utils/resolved-options"
import { acceleratedValues } from "../waapi/utils/accelerated-values"
import { colorProperties, supportsWaapi } from "../waapi/supports/waapi"
import { canGroupTransform } from "../waapi/transforms/TransformAnimation"
import type { MotionValue, StartAnimation } from "../../value"

/**
 * The clip one animate() call's values share, made by its first value.
 */
export interface ClipRef {
    clip?: Clip
}

/**
 * Whether a value can play on the call's clip: it's sure to run in JS,
 * on the same driver, without callbacks only a lone animation makes.
 */
function canClip(
    options: ValueAnimationOptions<any>,
    element: AnimationElement | undefined,
    ref: ClipRef
) {
    const { name, onPlay, onStop, onCancel, driver } = options as any

    if (onPlay || onStop || onCancel || options.isHandoff) return false
    if (ref.clip && ref.clip.options.driver !== driver) return false
    if (canGroupTransform(options)) return false

    /**
     * A DOM value WAAPI might run is left to the animation that decides
     * once its keyframes are read.
     */
    return !(
        element &&
        (acceleratedValues.has(name!) || colorProperties.has(name!)) &&
        supportsWaapi()
    )
}

function resolve<T extends AnyResolvedKeyframe>(
    track: ClipTrack<T>,
    value: MotionValue<T>,
    element: AnimationElement | undefined
) {
    const { options } = track
    const onResolved = (
        keyframes: ResolvedKeyframes<any>,
        finalKeyframe?: any
    ) => {
        applyResolvedKeyframes(options, keyframes, finalKeyframe as T)
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
        /**
         * Without a subject to read, the origin is the value's own, as the
         * default keyframe resolver reads it, without making one.
         */
        const keyframes = [...options.keyframes]

        if (keyframes[0] === null) {
            const current = value.get()
            keyframes[0] = current ?? keyframes[keyframes.length - 1]
            current === undefined && value.setCurrent(keyframes[0] as T)
        }

        fillWildcards(keyframes)
        onResolved(keyframes as T[])
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
        const options = valueAnimationOptions(
            name,
            value,
            target,
            transition,
            element,
            false,
            onComplete
        )

        if (!options) return

        if (!canClip(options, element, ref)) return createAnimation(options)

        fillAnimationDefaults(options)

        const clip = (ref.clip ||= new Clip(options.driver))
        if (options.autoplay === false) clip.options.autoplay = false

        const track = clip.add(options)
        resolve(track, value, element)

        return track
    }
