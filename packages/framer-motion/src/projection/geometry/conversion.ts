import { BoundingBox, Box, TransformPoint } from "motion-utils"

/**
 * Bounding boxes tend to be defined as top, left, right, bottom. For various operations
 * it's easier to consider each axis individually. This function returns a bounding box
 * as a map of single-axis min/max values.
 */
export function convertBoundingBoxToBox({
    top,
    left,
    right,
    bottom,
}: BoundingBox): Box {
    return {
        x: { min: left, max: right },
        y: { min: top, max: bottom },
    }
}

export function convertBoxToBoundingBox({ x, y }: Box): BoundingBox {
    return { top: y.min, right: x.max, bottom: y.max, left: x.min }
}

/**
 * Applies a TransformPoint function to a bounding box. TransformPoint is usually a function
 * provided by Framer to allow measured points to be corrected for device scaling. This is used
 * when measuring DOM elements and DOM event points.
 */
export function transformBoxPoints(
    point: BoundingBox,
    transformPoint?: TransformPoint
) {
    if (!transformPoint) return point
    const topLeft = transformPoint({ x: point.left, y: point.top })
    const bottomRight = transformPoint({ x: point.right, y: point.bottom })

    return {
        top: topLeft.y,
        left: topLeft.x,
        bottom: bottomRight.y,
        right: bottomRight.x,
    }
}
