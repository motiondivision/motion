import type {
    AnimationDefinition,
    TargetAndTransition,
    TargetResolver,
} from "../../node/types"
import type { AnimationType } from "../types"
import { resolveVariantFromProps } from "./resolve-variants"

/**
 * Resolves a variant if it's a variant resolver.
 * Uses `any` type for visualElement to avoid circular dependencies.
 */
export function resolveVariant(
    visualElement: any,
    definition?: TargetAndTransition | TargetResolver,
    custom?: any
): TargetAndTransition
export function resolveVariant(
    visualElement: any,
    definition?: AnimationDefinition,
    custom?: any
): TargetAndTransition | undefined
export function resolveVariant(
    visualElement: any,
    definition?: AnimationDefinition,
    custom?: any
) {
    return resolveVariantFromProps(
        visualElement.getProps(),
        definition,
        custom,
        visualElement
    )
}

/**
 * Exit variants resolve with AnimatePresence's custom, every other type
 * with the element's own.
 */
export const getTypeCustom = (visualElement: any, type?: AnimationType) =>
    type === "exit" ? visualElement.presenceContext?.custom : undefined
