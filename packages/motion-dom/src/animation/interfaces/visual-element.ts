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

    const animation = Array.isArray(definition)
        ? Promise.all(
              definition.map((variant) =>
                  animateVariant(visualElement, variant, options)
              )
          )
        : typeof definition === "string"
        ? animateVariant(visualElement, definition, options)
        : Promise.all(
              animateTarget(
                  visualElement,
                  resolveVariant(visualElement, definition, options.custom),
                  options
              )
          )

    return animation.then(() => {
        visualElement.notify("AnimationComplete", definition)
    })
}
