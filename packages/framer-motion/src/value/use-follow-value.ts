"use client"

import {
    AnyResolvedKeyframe,
    attachFollow,
    FollowValueOptions,
    isMotionValue,
    MotionValue,
} from "motion-dom"
import { useContext, useInsertionEffect } from "react"
import { MotionConfigContext } from "../context/MotionConfigContext"
import { useMotionValue } from "./use-motion-value"
import { useTransform } from "./use-transform"

/**
 * Creates a `MotionValue` that, when `set`, will use the specified animation transition to animate to its new state.
 *
 * Unlike `useSpring` which is limited to spring animations, `useFollowValue` accepts any motion transition
 * including spring, tween, inertia, and keyframes.
 *
 * It can either work as a stand-alone `MotionValue` by initialising it with a value, or as a subscriber
 * to another `MotionValue`.
 *
 * @remarks
 *
 * ```jsx
 * // Spring animation (default)
 * const x = useFollowValue(0, { stiffness: 300 })
 *
 * // Tween animation
 * const y = useFollowValue(0, { type: "tween", duration: 0.5, ease: "easeOut" })
 *
 * // Track another MotionValue with spring
 * const source = useMotionValue(0)
 * const z = useFollowValue(source, { type: "spring", damping: 10 })
 *
 * // Inertia animation
 * const w = useFollowValue(0, { type: "inertia", velocity: 100 })
 * ```
 *
 * @param inputValue - `MotionValue` or number. If provided a `MotionValue`, when the input `MotionValue` changes, the created `MotionValue` will animate towards that value using the specified transition.
 * @param options - Animation transition options. Supports all transition types: spring, tween, inertia, keyframes.
 * @returns `MotionValue`
 *
 * @public
 */
export function useFollowValue(
    source: MotionValue<string>,
    options?: FollowValueOptions
): MotionValue<string>
export function useFollowValue(
    source: string,
    options?: FollowValueOptions
): MotionValue<string>
export function useFollowValue(
    source: MotionValue<number>,
    options?: FollowValueOptions
): MotionValue<number>
export function useFollowValue(
    source: number,
    options?: FollowValueOptions
): MotionValue<number>
export function useFollowValue(
    source: MotionValue<string> | MotionValue<number> | AnyResolvedKeyframe,
    options: FollowValueOptions = {}
) {
    const { isStatic } = useContext(MotionConfigContext)
    const getFromSource = () => (isMotionValue(source) ? source.get() : source)

    // isStatic will never change, allowing early hooks return
    if (isStatic) {
        return useTransform(getFromSource)
    }

    const value = useMotionValue(getFromSource())

    useInsertionEffect(() => {
        return attachFollow(value, source, options)
    }, [value, JSON.stringify(options)])

    return value
}
