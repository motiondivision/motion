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

interface ElementSnapshot {
    element: HTMLElement
    parentElement: HTMLElement
    nextSibling: Node | null
    bounds: DOMRect
    layoutId: string | null
}

/**
 * Snapshot elements before mutation to track removals
 */
export function snapshotElements(
    scope: Element | Document
): Map<HTMLElement, ElementSnapshot> {
    const elements = getLayoutElements(scope)
    const snapshots = new Map<HTMLElement, ElementSnapshot>()

    for (const element of elements) {
        snapshots.set(element, {
            element,
            parentElement: element.parentElement as HTMLElement,
            nextSibling: element.nextSibling,
            bounds: element.getBoundingClientRect(),
            layoutId: getLayoutId(element),
        })
    }

    return snapshots
}

/**
 * Compare before/after snapshots to detect entering/exiting/persisting elements
 */
export function detectMutations(
    beforeSnapshots: Map<HTMLElement, ElementSnapshot>,
    scope: Element | Document
): MutationResult {
    const afterElements = new Set(getLayoutElements(scope))
    const beforeElements = new Set(beforeSnapshots.keys())

    const entering: HTMLElement[] = []
    const exiting: RemovedElement[] = []
    const persisting: HTMLElement[] = []
    const sharedEntering = new Map<string, HTMLElement>()
    const sharedExiting = new Map<string, HTMLElement>()

    // Find exiting elements (were in before, not in after)
    for (const element of beforeElements) {
        if (!afterElements.has(element)) {
            const snapshot = beforeSnapshots.get(element)!
            exiting.push({
                element,
                parentElement: snapshot.parentElement,
                nextSibling: snapshot.nextSibling,
                bounds: snapshot.bounds,
            })

            if (snapshot.layoutId) {
                sharedExiting.set(snapshot.layoutId, element)
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
