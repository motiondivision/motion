import { ElementOrSelector, resolveElements } from "motion-dom"

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

    const activeIntersections = new WeakMap<Element, ViewChangeHandler>()

    const onIntersectionChange: IntersectionObserverCallback = (entries) => {
        entries.forEach((entry) => {
            const onEnd = activeIntersections.get(entry.target)

            /**
             * If there's no change to the intersection, we don't need to
             * do anything here.
             */
            if (entry.isIntersecting === Boolean(onEnd)) return

            if (entry.isIntersecting) {
                const newOnEnd = onStart(entry.target, entry)
                if (typeof newOnEnd === "function") {
                    activeIntersections.set(entry.target, newOnEnd)
                } else {
                    observer.unobserve(entry.target)
                }
            } else if (typeof onEnd === "function") {
                onEnd(entry)
                activeIntersections.delete(entry.target)
            }
        })
    }

    const observer = new IntersectionObserver(onIntersectionChange, {
        root,
        rootMargin,
        threshold: typeof amount === "number" ? amount : thresholds[amount],
    })

    elements.forEach((element) => observer.observe(element))

    return () => observer.disconnect()
}
