import { isGestureActive } from "../../arena"

export const isDragging = {
    x: false,
    y: false,
}

/**
 * Whether any element is being dragged. `isDragging` and `setDragLock`
 * are kept for code that sets the lock itself; Motion's own drags report
 * to the gesture registry instead.
 */
export const isDragActive = () =>
    isDragging.x || isDragging.y || isGestureActive("drag")
