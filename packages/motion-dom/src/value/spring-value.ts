import { MotionValue, motionValue } from "."
import { JSAnimation } from "../animation/JSAnimation"
import { AnyResolvedKeyframe, SpringOptions } from "../animation/types"
import { frame } from "../frameloop"
import { isMotionValue } from "./utils/is-motion-value"

/**
 * Create a `MotionValue` that animates to its latest value using a spring.
 * Can either be a value or track another `MotionValue`.
 *
 * ```jsx
 * const x = motionValue(0)
 * const y = transformValue(() => x.get() * 2) // double x
 * ```
 *
 * @param transformer - A transform function. This function must be pure with no side-effects or conditional statements.
 * @returns `MotionValue`
 *
 * @public
 */
export function springValue<T extends AnyResolvedKeyframe>(
    source: T | MotionValue<T>,
    options?: SpringOptions
) {
    const initialValue = isMotionValue(source) ? source.get() : source
    const value = motionValue(initialValue)

    attachSpring(value, source, options)

    return value
}

export function attachSpring<T extends AnyResolvedKeyframe>(
    value: MotionValue<T>,
    source: T | MotionValue<T>,
    options?: SpringOptions
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

        activeAnimation = new JSAnimation({
            keyframes: [asNumber(value.get()), asNumber(latestValue)],
            velocity: value.getVelocity(),
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

        frame.postRender(startAnimation)
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
