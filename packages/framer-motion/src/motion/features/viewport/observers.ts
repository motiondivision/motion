type IntersectionHandler = (entry: IntersectionObserverEntry) => void

interface SharedObserver {
    observer: IntersectionObserver
    handlers: WeakMap<Element, Set<IntersectionHandler>>
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

function getObserver({ root, ...options }: IntersectionObserverInit) {
    const lookupRoot = root || document

    let rootObservers = observers.get(lookupRoot)
    if (!rootObservers) observers.set(lookupRoot, (rootObservers = {}))

    const key = JSON.stringify(options)

    if (!rootObservers[key]) {
        const handlers = new WeakMap<Element, Set<IntersectionHandler>>()
        rootObservers[key] = {
            handlers,
            observer: new IntersectionObserver(
                (entries) =>
                    entries.forEach((entry) =>
                        handlers
                            .get(entry.target)
                            ?.forEach((handler) => handler(entry))
                    ),
                { root, ...options }
            ),
        }
    }

    return rootObservers[key]
}

export function observeIntersection(
    element: Element,
    options: IntersectionObserverInit,
    handler: IntersectionHandler
) {
    const { observer, handlers } = getObserver(options)

    let elementHandlers = handlers.get(element)
    if (elementHandlers) {
        /**
         * Observe the element again, so this handler is told whether it's
         * in view. Handlers already watching it ignore the unchanged entry.
         */
        observer.unobserve(element)
    } else {
        handlers.set(element, (elementHandlers = new Set()))
    }
    elementHandlers.add(handler)
    observer.observe(element)

    return () => {
        elementHandlers!.delete(handler)
        if (
            !elementHandlers!.size &&
            handlers.get(element) === elementHandlers
        ) {
            handlers.delete(element)
            observer.unobserve(element)
        }
    }
}
