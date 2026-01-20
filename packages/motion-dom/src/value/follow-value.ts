import { MotionValue, motionValue } from "."
import { JSAnimation } from "../animation/JSAnimation"
import { AnyResolvedKeyframe, ValueAnimationTransition } from "../animation/types"
import { frame } from "../frameloop"
import { isMotionValue } from "./utils/is-motion-value"

/**
 * Options for useFollowValue hook, extending ValueAnimationTransition
 * but excluding lifecycle callbacks that don't make sense for the hook pattern.
 */
export type FollowValueOptions = Omit<
    ValueAnimationTransition,
    "onUpdate" | "onComplete" | "onPlay" | "onRepeat" | "onStop"
>

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
    const initialValue = value.get()

    let activeAnimation: JSAnimation<number> | null = null
    let latestValue = initialValue
    let latestSetter: (v: T) => void

    const unit =
        typeof initialValue === "string"
            ? initialValue.replace(/[\d.-]/g, "")
            : undefined

    const stopAnimation = () => {
        if (activeAnimation) {
            activeAnimation.stop()
            activeAnimation = null
        }
    }

    const startAnimation = () => {
        stopAnimation()

        const currentValue = asNumber(value.get())
        const targetValue = asNumber(latestValue)

        // Don't animate if we're already at the target
        if (currentValue === targetValue) {
            return
        }

        activeAnimation = new JSAnimation({
            keyframes: [currentValue, targetValue],
            velocity: value.getVelocity(),
            // Default to spring if no type specified (matches useSpring behavior)
            type: "spring",
            restDelta: 0.001,
            restSpeed: 0.01,
            ...options,
            onUpdate: latestSetter,
        })
    }

    value.attach((v, set) => {
        latestValue = v
        latestSetter = (latest) => set(parseValue(latest, unit) as T)

        frame.postRender(() => {
            startAnimation()
            value["events"].animationStart?.notify()
            activeAnimation?.then(() => {
                value["events"].animationComplete?.notify()
            })
        })
    }, stopAnimation)

    if (isMotionValue(source)) {
        const removeSourceOnChange = source.on("change", (v) =>
            value.set(parseValue(v, unit) as T)
        )

        const removeValueOnDestroy = value.on("destroy", removeSourceOnChange)

        return () => {
            removeSourceOnChange()
            removeValueOnDestroy()
        }
    }

    return stopAnimation
}

function parseValue(v: AnyResolvedKeyframe, unit?: string) {
    return unit ? v + unit : v
}

function asNumber(v: AnyResolvedKeyframe) {
    return typeof v === "number" ? v : parseFloat(v)
}
