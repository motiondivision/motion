import { resolveVariant } from "../../render/utils/resolve-dynamic-variants"
import type { AnimationDefinition } from "../../node/types"
import type { VisualElement } from "../../render/VisualElement"
import type { VisualElementAnimationOptions } from "./types"
import { animateTarget } from "./visual-element-target"
import { animateVariant } from "./visual-element-variant"

export function animateVisualElement(
    visualElement: VisualElement,
    definition: AnimationDefinition,
    options: VisualElementAnimationOptions = {}
) {
    visualElement.notify("AnimationStart", definition)

    // Create onDelayComplete callback that fires "AnimationPlay" event once
    const onDelayComplete = () => {
        visualElement.notify("AnimationPlay", definition)
    }

    const optionsWithDelayComplete = { ...options, onDelayComplete }

    let animation: Promise<any>

    if (Array.isArray(definition)) {
        const animations = definition.map((variant) =>
            animateVariant(visualElement, variant, optionsWithDelayComplete)
        )
        animation = Promise.all(animations)
    } else if (typeof definition === "string") {
        animation = animateVariant(visualElement, definition, optionsWithDelayComplete)
    } else {
        const resolvedDefinition =
            typeof definition === "function"
                ? resolveVariant(visualElement, definition, options.custom)
                : definition

        animation = Promise.all(
            animateTarget(visualElement, resolvedDefinition, optionsWithDelayComplete)
        )
    }

    return animation.then(() => {
        visualElement.notify("AnimationComplete", definition)
    })
}
