import { isAnimationControls } from "../../animation/utils/is-animation-controls"
import { MotionProps } from "../../motion/types"
import { isVariantLabel } from "./is-variant-label"
import { variantProps } from "./variant-props"

/**
 * Check if a component has any variant props that make it participate in the variant system.
 * This is used to determine if a component should build variant context for children.
 */
export function isControllingVariants(props: MotionProps) {
    return (
        isAnimationControls(props.animate) ||
        variantProps.some((name) =>
            isVariantLabel(props[name as keyof typeof props])
        )
    )
}

/**
 * Check if a component participates in the variant system at all.
 */
export function isVariantNode(props: MotionProps) {
    return Boolean(isControllingVariants(props) || props.variants)
}

/**
 * Check if a component is controlling the primary variant animation flow.
 * This only includes animate/initial - gesture props like whileHover, whileTap etc.
 * are NOT included because they are independent animations that should not
 * prevent a child from inheriting parent variants for staggerChildren.
 */
export function isControllingPrimaryVariants(props: MotionProps): boolean {
    return (
        isAnimationControls(props.animate) ||
        isVariantLabel(props.initial) ||
        isVariantLabel(props.animate)
    )
}
