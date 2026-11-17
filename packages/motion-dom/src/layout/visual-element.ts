import { adoptElement } from "../animation/animate/element"
import { hasTransform } from "../projection/utils/has-transform"
import { HTMLNode } from "../render/html/HTMLNode"
import { nodeStore } from "../render/store"
import type { VisualElement } from "../render/VisualElement"

/**
 * Get the node that imperative APIs like animateLayout() and drag()
 * render an element with, ready for a projection node to be attached:
 * its motion component's, or an HTMLNode, which is made if it has
 * neither. Values animate() has been rendering on the element move to
 * the new node.
 *
 * It's typed as the VisualElement a projection node is written for. An
 * HTMLNode has the parts of one that a projection node uses.
 */
export function resolveVisualElement(
    element: HTMLElement
): VisualElement<HTMLElement> {
    let visualElement = nodeStore.get(element) as any

    if (!visualElement?.scheduleRender) {
        visualElement = new HTMLNode(element)
        adoptElement(element, visualElement)
    }

    /**
     * A first-time element may carry a projection transform in its
     * inline style (e.g. it was cloned from an element mid-animation).
     * That transform isn't tracked in latestValues so the engine can't
     * reset it before measuring - clear it now so the first layout
     * measurement isn't inflated.
     */
    if (element.style.transform && !hasTransform(visualElement.latestValues)) {
        element.style.transform = ""
    }

    return visualElement
}
