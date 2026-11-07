import type {
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
} from "../types"
import { motionValue as createMotionValue, MotionValue } from "../../value"
import { isMotionValue } from "../../value/utils/is-motion-value"
import { startValue } from "./clip-value"

/**
 * Animate one value, or a number, on a JSAnimation made from its
 * transition, as animate() makes any other value's.
 */
export function animateSingleValue<V extends AnyResolvedKeyframe>(
    value: MotionValue<V> | V,
    keyframes: V | UnresolvedValueKeyframe<V>[],
    options: ValueAnimationTransition = {}
): AnimationPlaybackControlsWithThen {
    const motionValue = isMotionValue(value) ? value : createMotionValue(value)
    motionValue.run(
        startValue({ isOne: true }, "", motionValue, keyframes, options)
    )
    return motionValue.animation as AnimationPlaybackControlsWithThen
}
