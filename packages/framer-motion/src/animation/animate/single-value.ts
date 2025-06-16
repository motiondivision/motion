import {
    AnimationPlaybackControlsWithThen,
    motionValue as createMotionValue,
    isMotionValue,
    MotionValue,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
} from "motion-dom"
import { animateMotionValue } from "../interfaces/motion-value"

export function animateSingleValue<V extends string | number>(
    value: MotionValue<V> | V,
    keyframes: V | UnresolvedValueKeyframe<V>[],
    options?: ValueAnimationTransition
): AnimationPlaybackControlsWithThen {
    const motionValue = isMotionValue(value) ? value : createMotionValue(value)

    motionValue.start(animateMotionValue("", motionValue, keyframes, options))

    return motionValue.animation!
}
