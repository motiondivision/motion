import { AnimationPlaybackControls, ValueAnimationTransition } from "motion-dom"
import { GenericKeyframesTarget } from "../../types"
import { motionValue as createMotionValue, MotionValue } from "../../value"
import { isMotionValue } from "../../value/utils/is-motion-value"
import { animateMotionValue } from "../interfaces/motion-value"

export function animateSingleValue<V extends string | number>(
    value: MotionValue<V> | V,
    keyframes: V | GenericKeyframesTarget<V>,
    options?: ValueAnimationTransition
): AnimationPlaybackControls {
    const motionValue = isMotionValue(value) ? value : createMotionValue(value)

    motionValue.start(animateMotionValue("", motionValue, keyframes, options))

    return motionValue.animation!
}
