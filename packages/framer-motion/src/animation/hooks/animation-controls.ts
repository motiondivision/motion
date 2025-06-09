import type { AnimationDefinition } from "motion-dom"
import { invariant } from "motion-utils"
import { setTarget } from "../../render/utils/setters"
import type { VisualElement } from "../../render/VisualElement"
import { animateVisualElement } from "../interfaces/visual-element"
import { AnimationControls } from "../types"

function stopAnimation(visualElement: VisualElement) {
    visualElement.values.forEach((value) => value.stop())
}

function setVariants(visualElement: VisualElement, variantLabels: string[]) {
    const reversedLabels = [...variantLabels].reverse()

    reversedLabels.forEach((key) => {
        const variant = visualElement.getVariant(key)
        variant && setTarget(visualElement, variant)

        if (visualElement.variantChildren) {
            visualElement.variantChildren.forEach((child) => {
                setVariants(child, variantLabels)
            })
        }
    })
}

export function setValues(
    visualElement: VisualElement,
    definition: AnimationDefinition
) {
    if (Array.isArray(definition)) {
        return setVariants(visualElement, definition)
    } else if (typeof definition === "string") {
        return setVariants(visualElement, [definition])
    } else {
        setTarget(visualElement, definition as any)
    }
}

/**
 * @public
 */
export function animationControls(): AnimationControls {
    /**
     * Track whether the host component has mounted.
     */
    let hasMounted = false

    /**
     * A collection of linked component animation controls.
     */
    const subscribers = new Set<VisualElement>()

    const controls: AnimationControls = {
        subscribe(visualElement) {
            subscribers.add(visualElement)
            return () => void subscribers.delete(visualElement)
        },

        start(definition, transitionOverride) {
            invariant(
                hasMounted,
                "controls.start() should only be called after a component has mounted. Consider calling within a useEffect hook."
            )

            const animations: Array<Promise<any>> = []
            subscribers.forEach((visualElement) => {
                animations.push(
                    animateVisualElement(visualElement, definition, {
                        transitionOverride,
                    })
                )
            })

            return Promise.all(animations)
        },

        set(definition) {
            invariant(
                hasMounted,
                "controls.set() should only be called after a component has mounted. Consider calling within a useEffect hook."
            )

            return subscribers.forEach((visualElement) => {
                setValues(visualElement, definition)
            })
        },

        stop() {
            subscribers.forEach((visualElement) => {
                stopAnimation(visualElement)
            })
        },

        mount() {
            hasMounted = true

            return () => {
                hasMounted = false
                controls.stop()
            }
        },
    }

    return controls
}
