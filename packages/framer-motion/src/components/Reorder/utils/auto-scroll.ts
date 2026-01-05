export interface AutoScrollOptions {
    /**
     * The threshold in pixels from the edge of the scroll container
     * at which auto-scrolling begins.
     * @default 50
     */
    threshold?: number

    /**
     * The maximum scroll speed in pixels per frame.
     * @default 25
     */
    maxSpeed?: number
}

const defaultOptions: Required<AutoScrollOptions> = {
    threshold: 50,
    maxSpeed: 25,
}

export function createAutoScroll(
    axis: "x" | "y",
    options: AutoScrollOptions = {}
) {
    const mergedOptions = { ...defaultOptions, ...options }

    function getScrollAmount(
        pointerPosition: number,
        scrollElement: HTMLElement
    ): number {
        const { threshold, maxSpeed } = mergedOptions
        const rect = scrollElement.getBoundingClientRect()

        const isHorizontal = axis === "x"
        const start = isHorizontal ? rect.left : rect.top
        const end = isHorizontal ? rect.right : rect.bottom

        const distanceFromStart = pointerPosition - start
        const distanceFromEnd = end - pointerPosition

        if (distanceFromStart < threshold) {
            // Scroll backwards (up/left)
            const intensity = 1 - distanceFromStart / threshold
            return -maxSpeed * Math.pow(intensity, 2)
        } else if (distanceFromEnd < threshold) {
            // Scroll forwards (down/right)
            const intensity = 1 - distanceFromEnd / threshold
            return maxSpeed * Math.pow(intensity, 2)
        }

        return 0
    }

    function updateScroll(
        pointerPosition: number,
        scrollElement: HTMLElement | null
    ) {
        if (!scrollElement) return

        const scrollAmount = getScrollAmount(pointerPosition, scrollElement)

        if (scrollAmount !== 0) {
            if (axis === "x") {
                scrollElement.scrollLeft += scrollAmount
            } else {
                scrollElement.scrollTop += scrollAmount
            }
        }
    }

    function stop() {
        // No-op, kept for API consistency
    }

    return {
        updateScroll,
        stop,
    }
}
