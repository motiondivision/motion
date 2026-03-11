import type {
    AnimationDefinition,
    TargetAndTransition,
    TargetResolver,
} from "../../node/types"
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
    const props = visualElement.getProps()
    return resolveVariantFromProps(
        props,
        definition,
        custom !== undefined ? custom : props.custom,
        visualElement
    )
}
