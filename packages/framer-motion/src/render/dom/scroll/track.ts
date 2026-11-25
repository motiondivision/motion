import { cancelFrame, frame, frameData, resize, Process } from "motion-dom"
import { noop } from "motion-utils"
import { createScrollInfo, updateScrollInfo } from "./info"
import { createOnScrollHandler } from "./on-scroll-handler"
import { OnScrollHandler, OnScrollInfo, ScrollInfoOptions } from "./types"

const scrollListeners = new WeakMap<Element, VoidFunction>()
const resizeListeners = new WeakMap<Element, VoidFunction>()
const onScrollHandlers = new WeakMap<Element, Set<OnScrollHandler>>()
/**
 * Each container's frame read of its scroll size, with how many of its
 * subscribers asked for it, so it stops when the last of them does.
 */
const dimensionCheckProcesses = new WeakMap<Element, [Process, number]>()

export type ScrollTargets = Array<HTMLElement>

const getEventTarget = (element: Element) =>
    element === document.scrollingElement ? window : element

export function scrollInfo(
    onScroll: OnScrollInfo,
    {
        container = document.scrollingElement as Element,
        trackContentSize = false,
        ...options
    }: ScrollInfoOptions = {}
) {
    if (!container) return noop as VoidFunction

    let containerHandlers = onScrollHandlers.get(container)

    /**
     * Get the onScroll handlers for this container.
     * If one isn't found, create a new one.
     */
    if (!containerHandlers) {
        containerHandlers = new Set()
        onScrollHandlers.set(container, containerHandlers)
    }

    /**
     * Create a new onScroll handler for the provided callback.
     */
    const info = createScrollInfo()
    const containerHandler = createOnScrollHandler(
        container,
        onScroll,
        info,
        options
    )
    containerHandlers.add(containerHandler)

    /**
     * Check if there's a scroll event listener for this container.
     * If not, create one.
     */
    if (!scrollListeners.has(container)) {
        const containerInfo = createScrollInfo()

        const measureAll = () => {
            updateScrollInfo(container, containerInfo, frameData.timestamp)

            for (const handler of containerHandlers) {
                handler.measure(containerInfo)
            }

            frame.preUpdate(notifyAll)
        }

        const notifyAll = () => {
            for (const handler of containerHandlers) {
                handler.notify(containerInfo)
            }
        }

        const listener = () => frame.read(measureAll)

        scrollListeners.set(container, listener)

        const target = getEventTarget(container)
        window.addEventListener("resize", listener)
        if (container !== document.documentElement) {
            resizeListeners.set(container, resize(container, listener))
        }

        target.addEventListener("scroll", listener)

        listener()
    }

    /**
     * Enable content size tracking if requested and not already enabled.
     */
    const dimensionCheck =
        trackContentSize && dimensionCheckProcesses.get(container)
    if (dimensionCheck) dimensionCheck[1]++
    if (trackContentSize && !dimensionCheck) {
        const listener = scrollListeners.get(container)!

        // Store initial scroll dimensions (object is reused to avoid allocation)
        const size = {
            width: container.scrollWidth,
            height: container.scrollHeight,
        }

        // Add frame-based scroll dimension checking to detect content changes
        const checkScrollDimensions: Process = () => {
            const newWidth = container.scrollWidth
            const newHeight = container.scrollHeight

            if (size.width !== newWidth || size.height !== newHeight) {
                listener()
                size.width = newWidth
                size.height = newHeight
            }
        }

        // Schedule with keepAlive=true to run every frame
        dimensionCheckProcesses.set(container, [
            frame.read(checkScrollDimensions, true),
            1,
        ])
    }

    const listener = scrollListeners.get(container)!
    frame.read(listener, false, true)

    return () => {
        cancelFrame(listener)

        /**
         * Check if we even have any handlers for this container.
         */
        const currentHandlers = onScrollHandlers.get(container)
        if (!currentHandlers) return

        currentHandlers.delete(containerHandler)

        /**
         * The last subscriber tracking content size stops the frame read,
         * even while others still listen to scroll.
         */
        const check = trackContentSize && dimensionCheckProcesses.get(container)
        if (check && !--check[1]) {
            cancelFrame(check[0])
            dimensionCheckProcesses.delete(container)
        }

        if (currentHandlers.size) return

        /**
         * If no more handlers, remove the scroll listener too. The handler
         * set goes with it, as a measure still queued from this listener
         * would otherwise notify handlers added by a later scrollInfo call.
         */
        onScrollHandlers.delete(container)
        const scrollListener = scrollListeners.get(container)
        scrollListeners.delete(container)

        if (scrollListener) {
            getEventTarget(container).removeEventListener(
                "scroll",
                scrollListener
            )
            resizeListeners.get(container)?.()
            window.removeEventListener("resize", scrollListener)
        }
    }
}
