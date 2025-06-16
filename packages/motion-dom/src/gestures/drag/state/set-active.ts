import { isDragging } from "./is-active"

export function setDragLock(axis: boolean | "x" | "y" | "lockDirection") {
    if (axis === "x" || axis === "y") {
        if (isDragging[axis]) {
            return null
        } else {
            isDragging[axis] = true
            return () => {
                isDragging[axis] = false
            }
        }
    } else {
        if (isDragging.x || isDragging.y) {
            return null
        } else {
            isDragging.x = isDragging.y = true
            return () => {
                isDragging.x = isDragging.y = false
            }
        }
    }
}
