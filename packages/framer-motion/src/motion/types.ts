import type {
    AnyResolvedKeyframe,
    MotionNodeOptions,
    MotionValue,
} from "motion-dom"
import { CSSProperties } from "react"

/**
 * Either a string, or array of strings, that reference variants defined via the `variants` prop.
 * @public
 */
export type VariantLabels = string | string[]

import { SVGPathProperties, TransformProperties } from "motion-dom"
export { SVGPathProperties, TransformProperties }

export type MotionValueString = MotionValue<string>
export type MotionValueNumber = MotionValue<number>
export type MotionValueAny = MotionValue<any>
export type AnyMotionValue =
    | MotionValueNumber
    | MotionValueString
    | MotionValueAny

type MotionValueHelper<T> = T | AnyMotionValue
type MakeMotionHelper<T> = {
    [K in keyof T]: MotionValueHelper<T[K]>
}

type MakeCustomValueTypeHelper<T> = MakeMotionHelper<T>
export type MakeMotion<T> = MakeCustomValueTypeHelper<T>

export type MotionCSS = MakeMotion<
    Omit<CSSProperties, "rotate" | "scale" | "perspective" | "x" | "y" | "z">
>

/**
 * @public
 */
export type MotionTransform = MakeMotion<TransformProperties>

type MotionCSSVariable =
    | MotionValueNumber
    | MotionValueString
    | AnyResolvedKeyframe

/**
 * TODO: Currently unused, would like to reimplement with the ability
 * to still accept React.CSSProperties.
 */
export interface MotionCSSVariables {
    [key: `--${string}`]: MotionCSSVariable
}

type MotionSVGProps = MakeMotion<SVGPathProperties>

/**
 * @public
 */
export interface MotionStyle
    extends MotionCSS,
        MotionTransform,
        MotionSVGProps {}

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

    children?: React.ReactNode | MotionValueNumber | MotionValueString
}
