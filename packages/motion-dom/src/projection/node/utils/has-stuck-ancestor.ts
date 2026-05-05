const isScrollContainer = (overflow: string) =>
    overflow === "auto" ||
    overflow === "scroll" ||
    overflow === "hidden" ||
    overflow === "overlay"

/**
 * Walks up from `instance` and returns true if it has a `position: sticky`
 * ancestor that is currently *engaged* (stuck) and pinned to the viewport.
 *
 * `position: sticky` alone is not enough for an element to be viewport-
 * relative — only being currently stuck is. The walk also stops at any
 * scroll container, since sticky pins to its nearest scroll container, not
 * the viewport, and root scroll offset still applies in that case.
 */
export const hasStuckAncestor = (instance: HTMLElement): boolean => {
    let el = instance.parentElement
    while (el) {
        const style = window.getComputedStyle(el)

        if (
            isScrollContainer(style.overflowX) ||
            isScrollContainer(style.overflowY)
        ) {
            return false
        }

        if (style.position === "sticky") {
            const rect = el.getBoundingClientRect()
            const top = parseFloat(style.top)
            if (!isNaN(top) && rect.top <= top + 0.5) return true
            const bottom = parseFloat(style.bottom)
            if (
                !isNaN(bottom) &&
                window.innerHeight - rect.bottom <= bottom + 0.5
            ) {
                return true
            }
        }
        el = el.parentElement
    }
    return false
}
