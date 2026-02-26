import { cancelFrame, frame, frameData, resize, Process } from "motion-dom"
import { noop } from "motion-utils"
import { createScrollInfo } from "./info"
import { createOnScrollHandler } from "./on-scroll-handler"
import { OnScrollHandler, OnScrollInfo, ScrollInfoOptions } from "./types"

const scrollListeners = new WeakMap<Element, VoidFunction>()
const resizeListeners = new WeakMap<Element, VoidFunction>()
const onScrollHandlers = new WeakMap<Element, Set<OnScrollHandler>>()
const scrollSize = new WeakMap<Element, { width: number; height: number }>()
const dimensionCheckProcesses = new WeakMap<Element, Process>()

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
        const measureAll = () => {
            for (const handler of containerHandlers) {
                handler.measure(frameData.timestamp)
            }

            frame.preUpdate(notifyAll)
        }

        const notifyAll = () => {
            for (const handler of containerHandlers) {
                handler.notify()
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
    if (trackContentSize && !dimensionCheckProcesses.has(container)) {
        const listener = scrollListeners.get(container)!

        // Store initial scroll dimensions (object is reused to avoid allocation)
        const size = {
            width: container.scrollWidth,
            height: container.scrollHeight,
        }
        scrollSize.set(container, size)

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
        const dimensionCheckProcess = frame.read(checkScrollDimensions, true)
        dimensionCheckProcesses.set(container, dimensionCheckProcess)
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

        if (currentHandlers.size) return

        /**
         * If no more handlers, remove the scroll listener too.
         */
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

        // Clean up scroll dimension checking
        const dimensionCheckProcess = dimensionCheckProcesses.get(container)
        if (dimensionCheckProcess) {
            cancelFrame(dimensionCheckProcess)
            dimensionCheckProcesses.delete(container)
        }
        scrollSize.delete(container)
    }
}
