import { isObject } from "motion-utils"

/**
 * Checks if an element is an SVG element in a way
 * that works across iframes
 */
export function isSVGElement(element: unknown): element is SVGElement {
    return isObject(element) && "ownerSVGElement" in element
}
