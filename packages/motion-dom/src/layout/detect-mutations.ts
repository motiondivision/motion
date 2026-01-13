import type { MutationResult, RemovedElement } from "./types"

const LAYOUT_SELECTOR = "[data-layout], [data-layout-id]"

export function getLayoutElements(scope: Element | Document): HTMLElement[] {
    return Array.from(scope.querySelectorAll(LAYOUT_SELECTOR)) as HTMLElement[]
}

export function getLayoutId(element: Element): string | null {
    return element.getAttribute("data-layout-id")
}

export function hasLayout(element: Element): boolean {
    return (
        element.hasAttribute("data-layout") ||
        element.hasAttribute("data-layout-id")
    )
}

interface ElementRecord {
    element: HTMLElement
    parentElement: HTMLElement
    nextSibling: Node | null
    layoutId: string | null
}

/**
 * Track layout elements before mutation.
 * Does NOT measure bounds - that's handled by the projection system via willUpdate().
 */
export function trackLayoutElements(
    scope: Element | Document
): Map<HTMLElement, ElementRecord> {
    const elements = getLayoutElements(scope)
    const records = new Map<HTMLElement, ElementRecord>()

    for (const element of elements) {
        records.set(element, {
            element,
            parentElement: element.parentElement as HTMLElement,
            nextSibling: element.nextSibling,
            layoutId: getLayoutId(element),
        })
    }

    return records
}

/**
 * Compare before/after records to detect entering/exiting/persisting elements
 */
export function detectMutations(
    beforeRecords: Map<HTMLElement, ElementRecord>,
    scope: Element | Document
): MutationResult {
    const afterElements = new Set(getLayoutElements(scope))
    const beforeElements = new Set(beforeRecords.keys())

    const entering: HTMLElement[] = []
    const exiting: RemovedElement[] = []
    const persisting: HTMLElement[] = []
    const sharedEntering = new Map<string, HTMLElement>()
    const sharedExiting = new Map<string, HTMLElement>()

    // Find exiting elements (were in before, not in after)
    for (const element of beforeElements) {
        if (!afterElements.has(element)) {
            const record = beforeRecords.get(element)!
            exiting.push({
                element,
                parentElement: record.parentElement,
                nextSibling: record.nextSibling,
            })

            if (record.layoutId) {
                sharedExiting.set(record.layoutId, element)
            }
        }
    }

    // Find entering and persisting elements
    for (const element of afterElements) {
        if (!beforeElements.has(element)) {
            entering.push(element)
            const layoutId = getLayoutId(element)
            if (layoutId) {
                sharedEntering.set(layoutId, element)
            }
        } else {
            persisting.push(element)
        }
    }

    return {
        entering,
        exiting,
        persisting,
        sharedEntering,
        sharedExiting,
    }
}

/**
 * Check if an element is a "root" entering element (no entering ancestors)
 */
export function isRootEnteringElement(
    element: Element,
    allEntering: Set<Element>
): boolean {
    let parent = element.parentElement
    while (parent) {
        if (allEntering.has(parent)) return false
        parent = parent.parentElement
    }
    return true
}

/**
 * Check if an element is a "root" exiting element (no exiting ancestors)
 */
export function isRootExitingElement(
    element: Element,
    allExiting: Set<Element>
): boolean {
    let parent = element.parentElement
    while (parent) {
        if (allExiting.has(parent)) return false
        parent = parent.parentElement
    }
    return true
}
