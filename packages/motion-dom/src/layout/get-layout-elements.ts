const LAYOUT_SELECTOR = "[data-layout], [data-layout-id]"

export function getLayoutElements(scope: Element | Document): HTMLElement[] {
    const elements = Array.from(scope.querySelectorAll(LAYOUT_SELECTOR)) as HTMLElement[]

    // Include scope itself if it's an Element (not Document) and has layout attributes
    if (scope instanceof Element && hasLayout(scope)) {
        elements.unshift(scope as HTMLElement)
    }

    return elements
}

export function getLayoutId(element: Element): string | null {
    return element.getAttribute("data-layout-id")
}

function hasLayout(element: Element): boolean {
    return (
        element.hasAttribute("data-layout") ||
        element.hasAttribute("data-layout-id")
    )
}
