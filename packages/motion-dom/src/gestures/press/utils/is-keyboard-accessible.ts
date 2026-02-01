const interactiveElements = new Set(["INPUT", "SELECT", "TEXTAREA"])

/**
 * Checks if an element is an interactive form element that should prevent
 * drag gestures from starting when clicked.
 *
 * This specifically targets form controls where the user might want to select
 * text or interact with the control (e.g., sliders, dropdowns).
 *
 * Buttons and links are NOT included because they don't have click-and-move
 * actions of their own - they only respond to click events, so dragging
 * should still work when initiated from these elements.
 */
export function isElementKeyboardAccessible(element: Element) {
    return (
        interactiveElements.has(element.tagName) ||
        (element as HTMLElement).isContentEditable === true
    )
}
