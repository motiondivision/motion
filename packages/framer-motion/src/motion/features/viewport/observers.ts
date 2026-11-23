type IntersectionHandler = (entry: IntersectionObserverEntry) => void

/**
 * An element's handler, or its handlers once there's more than one, so
 * the usual single handler costs no Set.
 */
type ElementHandlers = IntersectionHandler | Set<IntersectionHandler>

export interface SharedObserver {
    observer: IntersectionObserver
    handlers: WeakMap<Element, ElementHandlers>
}

/**
 * Elements observed with the same root and settings share one
 * IntersectionObserver, so many in-view elements don't each make their own.
 * Observers are stored per root, under their serialised settings.
 */
const observers = new WeakMap<
    Element | Document,
    { [key: string]: SharedObserver }
>()

export function getObserver({ root, ...options }: IntersectionObserverInit) {
    const lookupRoot = root || document

    let rootObservers = observers.get(lookupRoot)
    if (!rootObservers) observers.set(lookupRoot, (rootObservers = {}))

    const key = JSON.stringify(options)

    if (!rootObservers[key]) {
        const handlers = new WeakMap<Element, ElementHandlers>()
        rootObservers[key] = {
            handlers,
            observer: new IntersectionObserver(
                (entries) => {
                    for (let i = 0; i < entries.length; i++) {
                        const entry = entries[i]
                        const handler = handlers.get(entry.target)
                        typeof handler === "function"
                            ? handler(entry)
                            : handler?.forEach((h) => h(entry))
                    }
                },
                { root, ...options }
            ),
        }
    }

    return rootObservers[key]
}

export function observe(
    { observer, handlers }: SharedObserver,
    element: Element,
    handler: IntersectionHandler
) {
    const current = handlers.get(element)

    if (current) {
        /**
         * Observe the element again, so this handler is told whether it's
         * in view. Handlers already watching it ignore the unchanged entry.
         */
        observer.unobserve(element)
        typeof current === "function"
            ? handlers.set(element, new Set([current, handler]))
            : current.add(handler)
    } else {
        handlers.set(element, handler)
    }

    observer.observe(element)
}

export function unobserve(
    { observer, handlers }: SharedObserver,
    element: Element,
    handler: IntersectionHandler
) {
    const current = handlers.get(element)
    if (!current) return

    /**
     * A handler that's no longer the element's, as after the element was
     * observed again, leaves it alone.
     */
    if (typeof current === "function") {
        if (current !== handler) return
    } else if (!current.delete(handler) || current.size) {
        return
    }

    handlers.delete(element)
    observer.unobserve(element)
}

export function observeIntersection(
    element: Element,
    options: IntersectionObserverInit,
    handler: IntersectionHandler
) {
    const shared = getObserver(options)
    observe(shared, element, handler)
    return () => unobserve(shared, element, handler)
}
