import { CSSProperties } from "react"
import { MotionValue } from "../value"
import { AnimationControls } from "../animation/types"
import {
    Variants,
    Target,
    Transition,
    TargetAndTransition,
    Omit,
    MakeCustomValueType,
} from "../types"
import { DraggableProps } from "../gestures/drag/types"
import { LayoutProps } from "./features/layout/types"
import { EventProps } from "../render/types"
import {
    PanHandlers,
    TapHandlers,
    HoverHandlers,
    FocusHandlers,
} from "../gestures/types"
import { ViewportProps } from "./features/viewport/types"

/**
 * Either a string, or array of strings, that reference variants defined via the `variants` prop.
 * @public
 */
export type VariantLabels = string | string[]

import { TransformProperties, SVGPathProperties } from "motion-dom"
export { TransformProperties, SVGPathProperties }

export interface CustomStyles {
    /**
     * Framer Library custom prop types. These are not actually supported in Motion - preferably
     * we'd have a way of external consumers injecting supported styles into this library.
     */
    size?: string | number
    radius?: string | number
    shadow?: string
    image?: string
}

export type MakeMotion<T> = MakeCustomValueType<{
    [K in keyof T]:
        | T[K]
        | MotionValue<number>
        | MotionValue<string>
        | MotionValue<any> // A permissive type for Custom value types
}>

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
    MakeMotion<SVGPathProperties> &
    MakeCustomValueType<CustomStyles>

export type OnUpdate = (v: Target) => void

/**
 * @public
 */
export interface AnimationProps {
    /**
     * Properties, variant label or array of variant labels to start in.
     *
     * Set to `false` to initialise with the values in `animate` (disabling the mount animation)
     *
     * ```jsx
     * // As values
     * <motion.div initial={{ opacity: 1 }} />
     *
     * // As variant
     * <motion.div initial="visible" variants={variants} />
     *
     * // Multiple variants
     * <motion.div initial={["visible", "active"]} variants={variants} />
     *
     * // As false (disable mount animation)
     * <motion.div initial={false} animate={{ opacity: 0 }} />
     * ```
     */
    initial?: boolean | Target | VariantLabels

    /**
     * Values to animate to, variant label(s), or `AnimationControls`.
     *
     * ```jsx
     * // As values
     * <motion.div animate={{ opacity: 1 }} />
     *
     * // As variant
     * <motion.div animate="visible" variants={variants} />
     *
     * // Multiple variants
     * <motion.div animate={["visible", "active"]} variants={variants} />
     *
     * // AnimationControls
     * <motion.div animate={animation} />
     * ```
     */
    animate?: AnimationControls | TargetAndTransition | VariantLabels | boolean

    /**
     * A target to animate to when this component is removed from the tree.
     *
     * This component **must** be the first animatable child of an `AnimatePresence` to enable this exit animation.
     *
     * This limitation exists because React doesn't allow components to defer unmounting until after
     * an animation is complete. Once this limitation is fixed, the `AnimatePresence` component will be unnecessary.
     *
     * ```jsx
     * import { AnimatePresence, motion } from 'framer-motion'
     *
     * export const MyComponent = ({ isVisible }) => {
     *   return (
     *     <AnimatePresence>
     *        {isVisible && (
     *          <motion.div
     *            initial={{ opacity: 0 }}
     *            animate={{ opacity: 1 }}
     *            exit={{ opacity: 0 }}
     *          />
     *        )}
     *     </AnimatePresence>
     *   )
     * }
     * ```
     */
    exit?: TargetAndTransition | VariantLabels

    /**
     * Variants allow you to define animation states and organise them by name. They allow
     * you to control animations throughout a component tree by switching a single `animate` prop.
     *
     * Using `transition` options like `delayChildren` and `staggerChildren`, you can orchestrate
     * when children animations play relative to their parent.

     *
     * After passing variants to one or more `motion` component's `variants` prop, these variants
     * can be used in place of values on the `animate`, `initial`, `whileFocus`, `whileTap` and `whileHover` props.
     *
     * ```jsx
     * const variants = {
     *   active: {
     *       backgroundColor: "#f00"
     *   },
     *   inactive: {
     *     backgroundColor: "#fff",
     *     transition: { duration: 2 }
     *   }
     * }
     *
     * <motion.div variants={variants} animate="active" />
     * ```
     */
    variants?: Variants

    /**
     * Default transition. If no `transition` is defined in `animate`, it will use the transition defined here.
     * ```jsx
     * const spring = {
     *   type: "spring",
     *   damping: 10,
     *   stiffness: 100
     * }
     *
     * <motion.div transition={spring} animate={{ scale: 1.2 }} />
     * ```
     */
    transition?: Transition
}

/**
 * @public
 */
export interface MotionAdvancedProps {
    /**
     * Custom data to use to resolve dynamic variants differently for each animating component.
     *
     * ```jsx
     * const variants = {
     *   visible: (custom) => ({
     *     opacity: 1,
     *     transition: { delay: custom * 0.2 }
     *   })
     * }
     *
     * <motion.div custom={0} animate="visible" variants={variants} />
     * <motion.div custom={1} animate="visible" variants={variants} />
     * <motion.div custom={2} animate="visible" variants={variants} />
     * ```
     *
     * @public
     */
    custom?: any

    /**
     * @public
     * Set to `false` to prevent inheriting variant changes from its parent.
     */
    inherit?: boolean

    /**
     * @public
     * Set to `false` to prevent throwing an error when a `motion` component is used within a `LazyMotion` set to strict.
     */
    ignoreStrict?: boolean
}

type ExternalMotionValues = {
    [key: string]: MotionValue<number> | MotionValue<string>
}

/**
 * Props for `motion` components.
 *
 * @public
 */
export interface MotionProps
    extends AnimationProps,
        EventProps,
        PanHandlers,
        TapHandlers,
        HoverHandlers,
        FocusHandlers,
        ViewportProps,
        DraggableProps,
        LayoutProps,
        MotionAdvancedProps {
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

    /**
     * Provide a set of motion values to perform animations on.
     *
     * @internal
     */
    values?: ExternalMotionValues

    /**
     * By default, Motion generates a `transform` property with a sensible transform order. `transformTemplate`
     * can be used to create a different order, or to append/preprend the automatically generated `transform` property.
     *
     * ```jsx
     * <motion.div
     *   style={{ x: 0, rotate: 180 }}
     *   transformTemplate={
     *     ({ x, rotate }) => `rotate(${rotate}deg) translateX(${x}px)`
     *   }
     * />
     * ```
     *
     * @param transform - The latest animated transform props.
     * @param generatedTransform - The transform string as automatically generated by Motion
     *
     * @public
     */
    transformTemplate?(
        transform: TransformProperties,
        generatedTransform: string
    ): string

    children?: React.ReactNode | MotionValue<number> | MotionValue<string>

    "data-framer-appear-id"?: string
}

export type TransformTemplate = (
    transform: TransformProperties,
    generatedTransform: string
) => string
