import { MotionValue, motionValue } from "."
import { spring } from "../animation/generators/spring"
import { AnyResolvedKeyframe, SpringOptions } from "../animation/types"
import { follow } from "./utils/follow"
import { isMotionValue } from "./utils/is-motion-value"

/**
 * Create a `MotionValue` that animates to its latest value using a spring.
 * Can either be a value or track another `MotionValue`.
 *
 * ```jsx
 * const x = motionValue(0)
 * const y = springValue(x, { stiffness: 300 })
 * ```
 *
 * @param source - Initial value or MotionValue to track
 * @param options - Spring configuration options
 * @returns `MotionValue`
 *
 * @public
 */
export function springValue<T extends AnyResolvedKeyframe>(
    source: T | MotionValue<T>,
    options?: SpringOptions
) {
    const value = motionValue(isMotionValue(source) ? source.get() : source)

    attachSpring(value, source, options)

    return value
}

/**
 * Attach a spring animation to a MotionValue that will animate whenever the value changes.
 *
 * @param value - The MotionValue to animate
 * @param source - Initial value or MotionValue to track
 * @param options - Spring configuration options
 * @returns Cleanup function
 *
 * @public
 */
export function attachSpring<T extends AnyResolvedKeyframe>(
    value: MotionValue<T>,
    source: T | MotionValue<T>,
    options?: SpringOptions
): VoidFunction {
    return follow(value, source, { ...options, type: spring })
}
