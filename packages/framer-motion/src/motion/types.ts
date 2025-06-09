import type { MotionNodeOptions, MotionValue } from "motion-dom"
import { CSSProperties } from "react"

/**
 * Either a string, or array of strings, that reference variants defined via the `variants` prop.
 * @public
 */
export type VariantLabels = string | string[]

import { SVGPathProperties, TransformProperties } from "motion-dom"
export { SVGPathProperties, TransformProperties }

export type MakeMotion<T> = {
    [K in keyof T]:
        | T[K]
        | MotionValue<number>
        | MotionValue<string>
        | MotionValue<any> // A permissive type for Custom value types
}

export type MotionCSS = MakeMotion<
    Omit<CSSProperties, "rotate" | "scale" | "perspective">
>

/**
 * @public
 */
export type MotionTransform = MakeMotion<TransformProperties>

/**
 * TODO: Currently unused, would like to reimplement with the ability
 * to still accept React.CSSProperties.
 */
export type MotionCSSVariables = {
    [key: `--${string}`]:
        | MotionValue<number>
        | MotionValue<string>
        | string
        | number
}

/**
 * @public
 */
export type MotionStyle = MotionCSS &
    MotionTransform &
    MakeMotion<SVGPathProperties>

/**
 * Props for `motion` components.
 *
 * @public
 */
export interface MotionProps extends MotionNodeOptions {
    /**
     *
     * The React DOM `style` prop, enhanced with support for `MotionValue`s and separate `transform` values.
     *
     * ```jsx
     * export const MyComponent = () => {
     *   const x = useMotionValue(0)
     *
     *   return <motion.div style={{ x, opacity: 1, scale: 0.5 }} />
     * }
     * ```
     */
    style?: MotionStyle

    children?: React.ReactNode | MotionValue<number> | MotionValue<string>
}
