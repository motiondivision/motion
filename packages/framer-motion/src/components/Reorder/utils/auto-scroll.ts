import { frameData } from "motion-dom"

const threshold = 50
// Pixels per millisecond (25px per frame at 60fps)
const maxSpeed = 1.5

const overflowStyles = new Set(["auto", "scroll"])

type ActiveEdge = "start" | "end" | null

interface ScrollState {
    edge: ActiveEdge
    limit: number
}

/**
 * Per axis and scrollable element, for the current drag: the edge it's
 * auto-scrolling towards, "start" (top/left) or "end" (bottom/right), and
 * its scroll limit when that began (Bug 1 fix). A drag in a Reorder.Board
 * scrolls on both axes, often of one element (like the page), and can
 * scroll several, so they're kept per axis and all cleared when it ends.
 */
const scrollStates = {
    x: new Map<HTMLElement, ScrollState>(),
    y: new Map<HTMLElement, ScrollState>(),
}

export function resetAutoScrollState(): void {
    scrollStates.x.clear()
    scrollStates.y.clear()
}

function isScrollableElement(element: Element, axis: "x" | "y"): boolean {
    const style = getComputedStyle(element)
    const overflow = axis === "x" ? style.overflowX : style.overflowY

    const isDocumentScroll =
        element === document.body ||
        element === document.documentElement

    /**
     * An element that scrolls on one axis computes overflow auto on both
     * (e.g. a column of a board that scrolls the other way), so it must also
     * have content to scroll on this one.
     */
    return (
        isDocumentScroll ||
        (overflowStyles.has(overflow) &&
            (axis === "x"
                ? element.scrollWidth > element.clientWidth
                : element.scrollHeight > element.clientHeight))
    )
}

function findScrollableAncestor(
    element: Element | null,
    axis: "x" | "y"
): HTMLElement | null {
    let current = element?.parentElement
    while (current) {
        if (isScrollableElement(current, axis)) {
            return current
        }
        current = current.parentElement
    }
    return null
}

/**
 * Speed ramps up towards the edge and is capped at maxSpeed once the
 * pointer reaches or passes it. This runs from onDrag, within a frame, so
 * scale by the frame's elapsed time to scroll at the same speed whatever
 * the display's refresh rate.
 */
function scrollSpeed(distanceFromEdge: number): number {
    const intensity = Math.min(1, 1 - distanceFromEdge / threshold)
    return maxSpeed * intensity * intensity * frameData.delta
}

function getScrollAmount(
    pointerPosition: number,
    scrollElement: HTMLElement,
    axis: "x" | "y"
): { amount: number; edge: ActiveEdge } {
    const rect = scrollElement.getBoundingClientRect()

    const start = axis === "x" ? Math.max(0, rect.left) : Math.max(0, rect.top)
    const end = axis === "x" ? Math.min(window.innerWidth, rect.right) : Math.min(window.innerHeight, rect.bottom)

    const distanceFromStart = pointerPosition - start
    const distanceFromEnd = end - pointerPosition

    if (distanceFromStart < threshold) {
        return { amount: -scrollSpeed(distanceFromStart), edge: "start" }
    } else if (distanceFromEnd < threshold) {
        return { amount: scrollSpeed(distanceFromEnd), edge: "end" }
    }

    return { amount: 0, edge: null }
}

export function autoScrollIfNeeded(
    groupElement: Element | null,
    pointerPosition: number,
    axis: "x" | "y",
    velocity: number
): void {
    if (!groupElement) return

    const scrollableAncestor = findScrollableAncestor(groupElement, axis)
    if (!scrollableAncestor) return

    // Convert pointer position from page coordinates to viewport coordinates.
    // The gesture system uses pageX/pageY but getBoundingClientRect() returns
    // viewport-relative coordinates, so we need to account for page scroll.
    const viewportPointerPosition =
        pointerPosition - (axis === "x" ? window.scrollX : window.scrollY)

    const { amount: scrollAmount, edge } = getScrollAmount(
        viewportPointerPosition,
        scrollableAncestor,
        axis
    )

    const states = scrollStates[axis]

    // If not in any threshold zone, clear this axis' state
    if (edge === null) {
        states.delete(scrollableAncestor)
        return
    }

    let state = states.get(scrollableAncestor)

    const isDocumentScroll =
        scrollableAncestor === document.body ||
        scrollableAncestor === document.documentElement

    // If not currently scrolling this edge, check velocity to see if we should start
    if (state?.edge !== edge) {
        // Only start scrolling if velocity is towards the edge
        const shouldStart =
            (edge === "start" && velocity < 0) ||
            (edge === "end" && velocity > 0)
        if (!shouldStart) return

        // Activate this edge, and record the initial scroll limit
        // (prevents infinite scroll)
        state = {
            edge,
            limit:
                axis === "x"
                    ? scrollableAncestor.scrollWidth - (isDocumentScroll ? window.innerWidth : scrollableAncestor.clientWidth)
                    : scrollableAncestor.scrollHeight - (isDocumentScroll ? window.innerHeight : scrollableAncestor.clientHeight),
        }
        states.set(scrollableAncestor, state)
    }

    // Cap scrolling at initial limit (prevents infinite scroll)
    if (scrollAmount > 0) {
        const currentScroll =
            axis === "x"
                ? (isDocumentScroll ? window.scrollX : scrollableAncestor.scrollLeft)
                : (isDocumentScroll ? window.scrollY : scrollableAncestor.scrollTop)
        if (currentScroll >= state.limit) return
    }

    // Apply scroll
    if (axis === "x") {
        if (isDocumentScroll) {
            window.scrollBy({ left: scrollAmount })
        } else {
            scrollableAncestor.scrollLeft += scrollAmount
        }
    } else {
        if (isDocumentScroll) {
            window.scrollBy({ top: scrollAmount })
        } else {
            scrollableAncestor.scrollTop += scrollAmount
        }
    }
}
