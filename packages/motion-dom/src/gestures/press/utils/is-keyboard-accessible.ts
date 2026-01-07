const focusableElements = new Set([
    "BUTTON",
    "INPUT",
    "SELECT",
    "TEXTAREA",
    "A",
])

export function isElementKeyboardAccessible(element: Element) {
    return (
        focusableElements.has(element.tagName) ||
        (element as HTMLElement).tabIndex !== -1
    )
}
