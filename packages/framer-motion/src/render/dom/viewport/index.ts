import {
    addToScope,
    bindToScope,
    ElementOrSelector,
    resolveElements,
} from "motion-dom"
import {
    getObserver,
    observe,
    unobserve,
} from "../../../motion/features/viewport/observers"

export type ViewChangeHandler = (entry: IntersectionObserverEntry) => void

type MarginValue = `${number}${"px" | "%"}`
type MarginType =
    | MarginValue
    | `${MarginValue} ${MarginValue}`
    | `${MarginValue} ${MarginValue} ${MarginValue}`
    | `${MarginValue} ${MarginValue} ${MarginValue} ${MarginValue}`

export interface InViewOptions {
    root?: Element | Document
    margin?: MarginType
    amount?: "some" | "all" | number
}

const thresholds = {
    some: 0,
    all: 1,
}

export function inView(
    elementOrSelector: ElementOrSelector,
    onStart: (
        element: Element,
        entry: IntersectionObserverEntry
    ) => void | ViewChangeHandler,
    { root, margin: rootMargin, amount = "some" }: InViewOptions = {}
): VoidFunction {
    const elements = resolveElements(elementOrSelector)
    onStart = bindToScope(onStart)

    const activeIntersections = new WeakMap<Element, ViewChangeHandler>()
    const options = {
        root: root as Element | Document | undefined,
        rootMargin,
        threshold: typeof amount === "number" ? amount : thresholds[amount],
    }

    /**
     * One element, as useInView observes, shares an observer with others
     * that use the same settings, so many calls don't each make one. Many
     * elements in one call already share this call's own observer.
     */
    const shared = elements.length === 1 && getObserver(options)

    const stop = (element: Element) =>
        shared
            ? unobserve(shared, element, onIntersectionChange)
            : observer!.unobserve(element)

    const onIntersectionChange = (entry: IntersectionObserverEntry) => {
        const element = entry.target
        const onEnd = activeIntersections.get(element)

        /**
         * If there's no change to the intersection, we don't need to
         * do anything here.
         */
        if (entry.isIntersecting === Boolean(onEnd)) return

        if (entry.isIntersecting) {
            const newOnEnd = onStart(element, entry)
            typeof newOnEnd === "function"
                ? activeIntersections.set(element, newOnEnd)
                : stop(element)
        } else if (typeof onEnd === "function") {
            onEnd(entry)
            activeIntersections.delete(element)
        }
    }

    const observer = shared
        ? undefined
        : new IntersectionObserver(
              (entries) => entries.forEach(onIntersectionChange),
              options
          )

    shared
        ? observe(shared, elements[0], onIntersectionChange)
        : elements.forEach((element) => observer!.observe(element))

    return addToScope(() =>
        shared ? stop(elements[0]) : observer!.disconnect()
    )
}
