import {
    animateMotionValue,
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    motionValue as createMotionValue,
    isMotionValue,
    MotionValue,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
} from "motion-dom"

export function animateSingleValue<V extends AnyResolvedKeyframe>(
    value: MotionValue<V> | V,
    keyframes: V | UnresolvedValueKeyframe<V>[],
    options?: ValueAnimationTransition
): AnimationPlaybackControlsWithThen {
    const motionValue = isMotionValue(value) ? value : createMotionValue(value)

    motionValue.start(animateMotionValue("", motionValue, keyframes, options))

    return motionValue.animation!
}
