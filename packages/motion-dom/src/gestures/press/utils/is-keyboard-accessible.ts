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

const textInputElements = new Set(["INPUT", "SELECT", "TEXTAREA"])

/**
 * Checks if an element has text selection or direct interaction behavior
 * that should block drag gestures from starting.
 *
 * This specifically targets form controls where the user might want to select
 * text or interact with the control (e.g., sliders, dropdowns).
 *
 * Buttons and links are NOT included because they don't have click-and-move
 * actions of their own - they only respond to click events, so dragging
 * should still work when initiated from these elements.
 */
export function isElementTextInput(element: Element) {
    return (
        textInputElements.has(element.tagName) ||
        (element as HTMLElement).isContentEditable === true
    )
}
