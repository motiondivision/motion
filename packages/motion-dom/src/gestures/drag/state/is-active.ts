export const isDragging = {
    x: false,
    y: false,
}

export function isDragActive() {
    return isDragging.x || isDragging.y
}
