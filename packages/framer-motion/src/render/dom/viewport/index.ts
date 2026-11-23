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
    const shared = getObserver({
        root: root as Element | Document | undefined,
        rootMargin,
        threshold: typeof amount === "number" ? amount : thresholds[amount],
    })

    /**
     * One handler for every element, so observing many costs no closure
     * each.
     */
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
                : unobserve(shared, element, onIntersectionChange)
        } else if (typeof onEnd === "function") {
            onEnd(entry)
            activeIntersections.delete(element)
        }
    }

    for (let i = 0; i < elements.length; i++) {
        observe(shared, elements[i], onIntersectionChange)
    }

    return addToScope(() => {
        for (let i = 0; i < elements.length; i++) {
            unobserve(shared, elements[i], onIntersectionChange)
        }
    })
}
