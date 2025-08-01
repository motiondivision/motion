"use client"

import { MotionValue } from "motion-dom"
import { invariant, warning } from "motion-utils"
import { useContext } from "react"
import { MotionContext } from "../context/MotionContext"
import { useMotionValue } from "./use-motion-value"
import { useTransform } from "./use-transform"

interface ScaleMotionValues {
    scaleX: MotionValue<number>
    scaleY: MotionValue<number>
}

// Keep things reasonable and avoid scale: Infinity. In practise we might need
// to add another value, opacity, that could interpolate scaleX/Y [0,0.01] => [0,1]
// to simply hide content at unreasonable scales.
const maxScale = 100000
export const invertScale = (scale: number) =>
    scale > 0.001 ? 1 / scale : maxScale

let hasWarned = false

/**
 * Returns a `MotionValue` each for `scaleX` and `scaleY` that update with the inverse
 * of their respective parent scales.
 *
 * This is useful for undoing the distortion of content when scaling a parent component.
 *
 * By default, `useInvertedScale` will automatically fetch `scaleX` and `scaleY` from the nearest parent.
 * By passing other `MotionValue`s in as `useInvertedScale({ scaleX, scaleY })`, it will invert the output
 * of those instead.
 *
 * ```jsx
 * const MyComponent = () => {
 *   const { scaleX, scaleY } = useInvertedScale()
 *   return <motion.div style={{ scaleX, scaleY }} />
 * }
 * ```
 *
 * @deprecated
 */
export function useInvertedScale(
    scale?: Partial<ScaleMotionValues>
): ScaleMotionValues {
    let parentScaleX = useMotionValue(1)
    let parentScaleY = useMotionValue(1)
    const { visualElement } = useContext(MotionContext)

    invariant(
        !!(scale || visualElement),
        "If no scale values are provided, useInvertedScale must be used within a child of another motion component."
    )

    warning(
        hasWarned,
        "useInvertedScale is deprecated and will be removed in 3.0. Use the layout prop instead."
    )

    hasWarned = true

    if (scale) {
        parentScaleX = scale.scaleX || parentScaleX
        parentScaleY = scale.scaleY || parentScaleY
    } else if (visualElement) {
        parentScaleX = visualElement.getValue("scaleX", 1)
        parentScaleY = visualElement.getValue("scaleY", 1)
    }

    const scaleX = useTransform(parentScaleX, invertScale)
    const scaleY = useTransform(parentScaleY, invertScale)

    return { scaleX, scaleY }
}
