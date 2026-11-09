import type { AnyResolvedKeyframe, ValueTransition } from "../types"
import type { UnresolvedKeyframes } from "../keyframes/KeyframesResolver"
import type { MotionValue, StartAnimation } from "../../value"
import type { AnimationElement } from "../keyframes/types"
import { MultiValueRef, startValue } from "../animate/multi-value"

/**
 * Animate one value on a clock of its own.
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
        const ref: MultiValueRef = {}
        const animation = startValue(
            ref,
            name,
            value,
            target,
            transition,
            element,
            false,
            isHandoff
        )(onComplete)
        ref.animation?.start()
        return animation
    }
