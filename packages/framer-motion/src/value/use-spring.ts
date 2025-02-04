import { SpringOptions } from "motion-dom"
import { noop } from "motion-utils"
import { useContext, useInsertionEffect, useRef } from "react"
import {
    MainThreadAnimation,
    animateValue,
} from "../animation/animators/MainThreadAnimation"
import { MotionConfigContext } from "../context/MotionConfigContext"
import { frame } from "../frameloop"
import { useConstant } from "../utils/use-constant"
import { useIsomorphicLayoutEffect } from "../utils/use-isomorphic-effect"
import { MotionValue } from "../value"
import { useMotionValue } from "./use-motion-value"
import { isMotionValue } from "./utils/is-motion-value"

/**
 * Creates a `MotionValue` that, when `set`, will use a spring animation to animate to its new state.
 *
 * It can either work as a stand-alone `MotionValue` by initialising it with a value, or as a subscriber
 * to another `MotionValue`.
 *
 * @remarks
 *
 * ```jsx
 * const x = useSpring(0, { stiffness: 300 })
 * const y = useSpring(x, { damping: 10 })
 * ```
 *
 * @param inputValue - `MotionValue` or number. If provided a `MotionValue`, when the input `MotionValue` changes, the created `MotionValue` will spring towards that value.
 * @param springConfig - Configuration options for the spring.
 * @returns `MotionValue`
 *
 * @public
 */
export function useSpring(
    source: MotionValue<string>,
    config?: SpringOptions
): MotionValue<string>
export function useSpring(
    source: string,
    config?: SpringOptions
): MotionValue<string>
export function useSpring(
    source: MotionValue<number>,
    config?: SpringOptions
): MotionValue<number>
export function useSpring(
    source: number,
    config?: SpringOptions
): MotionValue<number>
export function useSpring(
    source: MotionValue<string> | MotionValue<number> | string | number,
    config: SpringOptions = {}
) {
    const { isStatic } = useContext(MotionConfigContext)
    const activeSpringAnimation = useRef<MainThreadAnimation<number> | null>(
        null
    )

    const initialValue = useConstant(() =>
        isMotionValue(source) ? source.get() : source
    )
    const unit = useConstant(() =>
        typeof initialValue === "string"
            ? initialValue.replace(/[\d.-]/g, "")
            : undefined
    )

    const value = useMotionValue(initialValue)
    const latestValue = useRef<number | string>(initialValue)
    const latestSetter = useRef<(v: number) => void>(noop)

    const startAnimation = () => {
        stopAnimation()

        activeSpringAnimation.current = animateValue({
            keyframes: [asNumber(value.get()), asNumber(latestValue.current)],
            velocity: value.getVelocity(),
            type: "spring",
            restDelta: 0.001,
            restSpeed: 0.01,
            ...config,
            onUpdate: latestSetter.current,
        })
    }

    const stopAnimation = () => {
        if (activeSpringAnimation.current) {
            activeSpringAnimation.current.stop()
        }
    }

    useInsertionEffect(() => {
        return value.attach((v, set) => {
            if (isStatic) return set(v)

            latestValue.current = v
            latestSetter.current = (latest) => set(parseValue(latest, unit))

            frame.postRender(startAnimation)

            return value.get()
        }, stopAnimation)
    }, [JSON.stringify(config)])

    useIsomorphicLayoutEffect(() => {
        if (isMotionValue(source)) {
            return source.on("change", (v) => value.set(parseValue(v, unit)))
        }
    }, [value, unit])

    return value
}

function parseValue(v: string | number, unit?: string) {
    return unit ? v + unit : v
}

function asNumber(v: string | number) {
    return typeof v === "number" ? v : parseFloat(v)
}
