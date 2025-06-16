import { isSVGElement } from "./is-svg-element"

/**
 * Checks if an element is specifically an SVGSVGElement (the root SVG element)
 * in a way that works across iframes
 */
export function isSVGSVGElement(element: unknown): element is SVGSVGElement {
    return isSVGElement(element) && element.tagName === "svg"
}
