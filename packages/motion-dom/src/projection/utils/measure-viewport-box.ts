import { TransformPoint } from "motion-utils"
import {
    convertBoundingBoxToBox,
    transformBoxPoints,
} from "../geometry/conversion"

/**
 * In its own file so that code without layout animations doesn't share a
 * module, and so a chunk, with the projection geometry.
 */
export function measureViewportBox(
    instance: HTMLElement,
    transformPoint?: TransformPoint
) {
    return convertBoundingBoxToBox(
        transformBoxPoints(instance.getBoundingClientRect(), transformPoint)
    )
}
