import { isObject } from "motion-utils"

/**
 * Checks if an element is an HTML element in a way
 * that works across iframes
 */
export function isHTMLElement(element: unknown): element is HTMLElement {
    return isObject(element) && "offsetHeight" in element
}
