import { TargetAndTransition, TargetResolver } from "../../types"
import type { VisualElement } from "../VisualElement"
import { resolveVariantFromProps } from "./resolve-variants"

/**
 * Resovles a variant if it's a variant resolver
 */
export function resolveVariant(
    visualElement: VisualElement,
    definition?: TargetAndTransition | TargetResolver,
    custom?: any
): TargetAndTransition
export function resolveVariant(
    visualElement: VisualElement,
    definition?: string | TargetAndTransition | TargetResolver,
    custom?: any
): TargetAndTransition | undefined
export function resolveVariant(
    visualElement: VisualElement,
    definition?: string | TargetAndTransition | TargetResolver,
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
