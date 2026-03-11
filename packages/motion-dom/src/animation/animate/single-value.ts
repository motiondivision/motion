import { animateMotionValue } from "../interfaces/motion-value"
import type {
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
} from "../types"
import {
    motionValue as createMotionValue,
    MotionValue,
} from "../../value"
import { isMotionValue } from "../../value/utils/is-motion-value"

export function animateSingleValue<V extends AnyResolvedKeyframe>(
    value: MotionValue<V> | V,
    keyframes: V | UnresolvedValueKeyframe<V>[],
    options?: ValueAnimationTransition
): AnimationPlaybackControlsWithThen {
    const motionValue = isMotionValue(value) ? value : createMotionValue(value)

    motionValue.start(animateMotionValue("", motionValue, keyframes, options))

    return motionValue.animation!
}
