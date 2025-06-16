import type { AnimationDefinition } from "motion-dom"
import { resolveVariant } from "../../render/utils/resolve-dynamic-variants"
import { VisualElement } from "../../render/VisualElement"
import { VisualElementAnimationOptions } from "./types"
import { animateTarget } from "./visual-element-target"
import { animateVariant } from "./visual-element-variant"

export function animateVisualElement(
    visualElement: VisualElement,
    definition: AnimationDefinition,
    options: VisualElementAnimationOptions = {}
) {
    visualElement.notify("AnimationStart", definition)
    let animation: Promise<any>

    if (Array.isArray(definition)) {
        const animations = definition.map((variant) =>
            animateVariant(visualElement, variant, options)
        )
        animation = Promise.all(animations)
    } else if (typeof definition === "string") {
        animation = animateVariant(visualElement, definition, options)
    } else {
        const resolvedDefinition =
            typeof definition === "function"
                ? resolveVariant(visualElement, definition, options.custom)
                : definition

        animation = Promise.all(
            animateTarget(visualElement, resolvedDefinition, options)
        )
    }

    return animation.then(() => {
        visualElement.notify("AnimationComplete", definition)
    })
}
