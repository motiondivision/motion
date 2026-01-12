/**
 * Utilities for observing DOM mutations during layout animations.
 * Used to detect elements added/removed during mutation callbacks
 * for enter/exit animations.
 */

export interface MutationObserverResult {
    /** Elements that were added to the DOM */
    addedElements: HTMLElement[]
    /** Elements that were removed from the DOM, with their pre-removal bounds */
    removedElements: Array<{ element: HTMLElement; bounds: DOMRect }>
}

/**
 * Selectors for elements that should participate in layout animations
 */
const LAYOUT_SELECTORS = [
    "[data-layout]",
    "[data-layout-id]",
    "[data-animate-layout]",
]


/**
 * Execute a mutation callback while observing DOM changes.
 * Returns information about elements that were added or removed.
 *
 * Uses a snapshot approach since MutationObserver callbacks are async.
 *
 * @param container - The container to observe for mutations
 * @param mutation - The mutation callback to execute
 * @returns Information about elements added/removed during the mutation
 *
 * @example
 * ```typescript
 * const { addedElements, removedElements } = observeMutation(
 *   document.body,
 *   () => {
 *     list.innerHTML = newContent
 *   }
 * )
 *
 * // Handle newly added elements with enter animations
 * addedElements.forEach(el => animateEnter(el))
 *
 * // Handle removed elements with exit animations
 * removedElements.forEach(el => animateExit(el))
 * ```
 */
export function observeMutation(
    container: Element,
    mutation: () => void
): MutationObserverResult {
    // Snapshot approach: capture layout elements before and after mutation
    // MutationObserver callbacks are async microtasks, so we use direct comparison instead
    const selector = LAYOUT_SELECTORS.join(", ")

    // Capture elements and their bounds before mutation
    const elementsBefore = new Map<Element, DOMRect>()
    container.querySelectorAll(selector).forEach((el) => {
        elementsBefore.set(el, el.getBoundingClientRect())
    })

    // Execute the mutation
    mutation()

    // Capture elements after mutation
    const elementsAfter = new Set(container.querySelectorAll(selector))

    // Find added elements (in after but not in before)
    const addedElements: HTMLElement[] = []
    elementsAfter.forEach((el) => {
        if (!elementsBefore.has(el) && el instanceof HTMLElement) {
            addedElements.push(el)
        }
    })

    // Find removed elements (in before but not in after) with their pre-removal bounds
    const removedElements: Array<{ element: HTMLElement; bounds: DOMRect }> = []
    elementsBefore.forEach((bounds, el) => {
        if (!elementsAfter.has(el) && el instanceof HTMLElement) {
            removedElements.push({ element: el, bounds })
        }
    })

    return { addedElements, removedElements }
}

/**
 * Find the common ancestor of a list of elements.
 * Used to determine the container for mutation observation.
 *
 * @param elements - Elements to find common ancestor of
 * @returns The common ancestor element, or document.body if none found
 */
export function findCommonAncestor(elements: Element[]): Element {
    if (elements.length === 0) return document.body
    if (elements.length === 1) return elements[0].parentElement ?? document.body

    // Start with the first element's ancestors
    const ancestors = new Set<Element>()
    let el: Element | null = elements[0]
    while (el) {
        ancestors.add(el)
        el = el.parentElement
    }

    // Find the first ancestor that contains all elements
    for (let i = 1; i < elements.length; i++) {
        el = elements[i]
        while (el) {
            if (ancestors.has(el)) {
                // Check if this element contains all other elements
                const containsAll = elements.every((e) =>
                    el === e || el?.contains(e)
                )
                if (containsAll) {
                    return el
                }
            }
            el = el.parentElement
        }
    }

    return document.body
}

/**
 * Keep an element in the DOM for exit animation.
 * Returns a cleanup function to remove the clone after animation.
 *
 * @param element - The element that was removed
 * @param bounds - The element's bounds before removal
 * @param container - Container to add the clone to
 * @returns Object with clone element and cleanup function
 */
export function preserveElementForExit(
    element: HTMLElement,
    bounds: DOMRect,
    container: Element
): { clone: HTMLElement; cleanup: () => void } {
    // Clone the element to keep it in the DOM for animation
    const clone = element.cloneNode(true) as HTMLElement

    // Position it absolutely at its last known position (from pre-captured bounds)
    clone.style.position = "fixed"
    clone.style.top = `${bounds.top}px`
    clone.style.left = `${bounds.left}px`
    clone.style.width = `${bounds.width}px`
    clone.style.height = `${bounds.height}px`
    clone.style.margin = "0"
    clone.style.pointerEvents = "none"
    clone.style.zIndex = "9999"

    // Mark as exiting to prevent re-observation
    clone.setAttribute("data-layout-exiting", "true")

    // Add to container
    container.appendChild(clone)

    return {
        clone,
        cleanup: () => {
            if (clone.parentNode) {
                clone.parentNode.removeChild(clone)
            }
        },
    }
}
