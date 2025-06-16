import { cancelFrame, frame, frameData, resize } from "motion-dom"
import { noop } from "motion-utils"
import { createScrollInfo } from "./info"
import { createOnScrollHandler } from "./on-scroll-handler"
import { OnScrollHandler, OnScrollInfo, ScrollInfoOptions } from "./types"

const scrollListeners = new WeakMap<Element, VoidFunction>()
const resizeListeners = new WeakMap<Element, VoidFunction>()
const onScrollHandlers = new WeakMap<Element, Set<OnScrollHandler>>()

export type ScrollTargets = Array<HTMLElement>

const getEventTarget = (element: Element) =>
    element === document.scrollingElement ? window : element

export function scrollInfo(
    onScroll: OnScrollInfo,
    {
        container = document.scrollingElement as Element,
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
        window.addEventListener("resize", listener, { passive: true })
        if (container !== document.documentElement) {
            resizeListeners.set(container, resize(container, listener))
        }

        target.addEventListener("scroll", listener, { passive: true })

        listener()
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
    }
}
