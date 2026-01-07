const interactiveElements = new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A",
])

/**
 * Checks if an element is an interactive form element that should prevent
 * drag gestures from starting when clicked.
 *
 * This specifically targets form controls, buttons, and links - not just any
 * element with tabIndex, since motion elements with tap handlers automatically
 * get tabIndex=0 for keyboard accessibility.
 */
export function isElementKeyboardAccessible(element: Element) {
    return (
        interactiveElements.has(element.tagName) ||
        (element as HTMLElement).isContentEditable === true
    )
}
