import { MotionValue, motionValue } from "."
import { keyframes } from "../animation/generators/keyframes"
import {
    AnyResolvedKeyframe,
    ValueAnimationTransition,
} from "../animation/types"
import { replaceTransitionType } from "../animation/utils/replace-transition-type"
import { follow, FollowOptions } from "./utils/follow"
import { isMotionValue } from "./utils/is-motion-value"

/**
 * Options for useFollowValue hook, extending ValueAnimationTransition
 * but excluding lifecycle callbacks that don't make sense for the hook pattern,
 * and repeat options, as a follower always heads for its latest value.
 */
export type FollowValueOptions = Omit<
    ValueAnimationTransition,
    | "onUpdate"
    | "onComplete"
    | "onPlay"
    | "onRepeat"
    | "onStop"
    | "repeat"
    | "repeatType"
    | "repeatDelay"
> & {
    /**
     * When true, the first change from a tracked `MotionValue` source
     * will jump to the new value instead of animating. Subsequent
     * changes animate normally. This prevents unwanted animations
     * on page refresh or back navigation (e.g. `useScroll` + `useSpring`).
     *
     * @default false
     */
    skipInitialAnimation?: boolean
}

/**
 * Create a `MotionValue` that animates to its latest value using any transition type.
 * Can either be a value or track another `MotionValue`.
 *
 * ```jsx
 * const x = motionValue(0)
 * const y = followValue(x, { type: "spring", stiffness: 300 })
 * // or with tween
 * const z = followValue(x, { type: "tween", duration: 0.5, ease: "easeOut" })
 * ```
 *
 * @param source - Initial value or MotionValue to track
 * @param options - Animation transition options
 * @returns `MotionValue`
 *
 * @public
 */
export function followValue<T extends AnyResolvedKeyframe>(
    source: T | MotionValue<T>,
    options?: FollowValueOptions
) {
    const initialValue = isMotionValue(source) ? source.get() : source
    const value = motionValue(initialValue)

    attachFollow(value, source, options)

    return value
}

/**
 * Attach an animation to a MotionValue that will animate whenever the value changes.
 * Similar to attachSpring but supports any transition type (spring, tween, inertia, etc.)
 *
 * @param value - The MotionValue to animate
 * @param source - Initial value or MotionValue to track
 * @param options - Animation transition options
 * @returns Cleanup function
 *
 * @public
 */
export function attachFollow<T extends AnyResolvedKeyframe>(
    value: MotionValue<T>,
    source: T | MotionValue<T>,
    options: FollowValueOptions = {}
): VoidFunction {
    // Default to spring if no type specified (matches useSpring behavior)
    const transition: FollowValueOptions = { type: "spring", ...options }
    replaceTransitionType(transition)
    transition.type = transition.type || keyframes

    return follow(value, source, transition as FollowOptions)
}
