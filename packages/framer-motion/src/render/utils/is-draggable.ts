import type { VisualElement } from "motion-dom"

export function isDraggable(visualElement: VisualElement) {
    const { drag, _dragX } = visualElement.getProps()
    return drag && !_dragX
}
