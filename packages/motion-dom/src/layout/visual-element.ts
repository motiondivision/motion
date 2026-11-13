import { adoptElement } from "../animation/animate/element"
import { hasTransform } from "../projection/utils/has-transform"
import { HTMLVisualElement } from "../render/html/HTMLVisualElement"
import { nodeStore } from "../render/store"
import { VisualElement } from "../render/VisualElement"

/**
 * Get the VisualElement that imperative APIs like animateLayout() and
 * drag() render an element with, creating one if it has none, ready for
 * a projection node to be attached. Values animate() has been rendering
 * on the element move to it when it mounts.
 */
export function resolveVisualElement(element: HTMLElement): HTMLVisualElement {
    let visualElement = nodeStore.get(element) as HTMLVisualElement | undefined

    if (!(visualElement instanceof VisualElement)) {
        visualElement = new HTMLVisualElement(
            {
                props: {},
                presenceContext: null,
                visualState: { latestValues: {} },
            },
            { allowProjection: true }
        )

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
