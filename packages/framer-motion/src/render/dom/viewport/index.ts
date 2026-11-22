import {
    addToScope,
    bindToScope,
    ElementOrSelector,
    resolveElements,
} from "motion-dom"
import { observeIntersection } from "../../../motion/features/viewport/observers"

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

    const stops = elements.map((element) => {
        const stop = observeIntersection(element, options, (entry) => {
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
                    : stop()
            } else if (typeof onEnd === "function") {
                onEnd(entry)
                activeIntersections.delete(element)
            }
        })
        return stop
    })

    return addToScope(() => stops.forEach((stop) => stop()))
}
