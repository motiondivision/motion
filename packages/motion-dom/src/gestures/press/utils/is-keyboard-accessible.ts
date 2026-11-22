const keyboardAccessibleElements = new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A",
])

/**
 * Checks if an element is natively keyboard accessible (focusable).
 * Used by the press gesture to determine if we need to add tabIndex.
 */
export function isElementKeyboardAccessible(element: Element) {
    return (
        keyboardAccessibleElements.has(element.tagName) ||
        (element as HTMLElement).isContentEditable === true
    )
}
