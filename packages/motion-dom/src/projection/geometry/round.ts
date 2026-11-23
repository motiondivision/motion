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
let roundPoint: ((v: number) => number) | undefined

function roundAxis(axis: Axis, round: (v: number) => number): void {
    // Round to the nearest .5 pixels to support subpixel layouts
    axis.min = round(axis.min)
    axis.max = round(axis.max)
}

export function roundBox(box: Box): void {
    roundPoint ??=
        userAgentContains("applewebkit/") && !userAgentContains("chrome/")
            ? Math.round
            : noop
    roundAxis(box.x, roundPoint)
    roundAxis(box.y, roundPoint)
}
