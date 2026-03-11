import { isVariantLabel } from "./is-variant-label"
import { variantProps } from "./variant-props"

const numVariantProps = variantProps.length

type VariantStateContext = {
    initial?: string | string[]
    animate?: string | string[]
    exit?: string | string[]
    whileHover?: string | string[]
    whileDrag?: string | string[]
    whileFocus?: string | string[]
    whileTap?: string | string[]
}

/**
 * Get variant context from a visual element's parent chain.
 * Uses `any` type for visualElement to avoid circular dependencies.
 */
export function getVariantContext(
    visualElement?: any
): undefined | VariantStateContext {
    if (!visualElement) return undefined

    if (!visualElement.isControllingVariants) {
        const context = visualElement.parent
            ? getVariantContext(visualElement.parent) || {}
            : {}
        if (visualElement.props.initial !== undefined) {
            context.initial = visualElement.props.initial as any
        }
        return context
    }

    const context: VariantStateContext = {}
    for (let i = 0; i < numVariantProps; i++) {
        const name = variantProps[i] as keyof typeof context
        const prop = visualElement.props[name]

        if (isVariantLabel(prop) || prop === false) {
            ;(context as any)[name] = prop
        }
    }

    return context
}
