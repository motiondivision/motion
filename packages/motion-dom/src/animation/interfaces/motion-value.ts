import type { AnimationElement } from "../keyframes/types"
import type { UnresolvedKeyframes } from "../keyframes/KeyframesResolver"
import type { AnyResolvedKeyframe, ValueTransition } from "../types"
import type { MotionValue, StartAnimation } from "../../value"
import { ClipRef, startValue } from "../animate/clip-value"

/**
 * Animate one value, as animate() does: on a clip of its own for a value
 * of an element, otherwise on a JSAnimation.
 */
export const animateMotionValue =
    <V extends AnyResolvedKeyframe>(
        name: string,
        value: MotionValue<V>,
        target: V | UnresolvedKeyframes<V>,
        transition: ValueTransition & { elapsed?: number } = {},
        element?: AnimationElement,
        isHandoff?: boolean
    ): StartAnimation =>
    (onComplete) => {
        const ref: ClipRef = { isOne: !element }
        const animation = startValue(
            ref,
            name,
            value,
            target,
            transition,
            element,
            isHandoff
        )(onComplete)
        ref.clip?.start()
        return animation
    }
