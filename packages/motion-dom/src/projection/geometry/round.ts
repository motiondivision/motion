import type { Axis, Box } from "motion-utils"
import { noop } from "motion-utils"

const userAgentContains = (string: string) =>
    typeof navigator !== "undefined" &&
    navigator.userAgent &&
    navigator.userAgent.toLowerCase().includes(string)

/**
 * Measured bounding boxes must be rounded in Safari and
 * left untouched in Chrome, otherwise non-integer layouts within scaled-up elements
 * can appear to jump.
 */
const roundPoint =
    userAgentContains("applewebkit/") && !userAgentContains("chrome/")
        ? Math.round
        : noop

function roundAxis(axis: Axis): void {
    // Round to the nearest .5 pixels to support subpixel layouts
    axis.min = roundPoint(axis.min)
    axis.max = roundPoint(axis.max)
}

export function roundBox(box: Box): void {
    roundAxis(box.x)
    roundAxis(box.y)
}
