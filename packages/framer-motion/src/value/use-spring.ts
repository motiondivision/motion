"use client"

import { MotionValue, SpringOptions } from "motion-dom"
import { useAnimatedValue } from "./use-animated-value"

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
    options?: SpringOptions
): MotionValue<string>
export function useSpring(
    source: string,
    options?: SpringOptions
): MotionValue<string>
export function useSpring(
    source: MotionValue<number>,
    options?: SpringOptions
): MotionValue<number>
export function useSpring(
    source: number,
    options?: SpringOptions
): MotionValue<number>
export function useSpring(
    source: MotionValue<string> | MotionValue<number> | string | number,
    options: SpringOptions = {}
) {
    return useAnimatedValue(source as any, { type: "spring", ...options })
}
