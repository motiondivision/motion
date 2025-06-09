import { isSVGElement } from "../utils/is-svg-element"
import { ElementOrSelector, resolveElements } from "../utils/resolve-elements"
import { ResizeHandler } from "./types"

const resizeHandlers = new WeakMap<Element, Set<ResizeHandler<Element>>>()

let observer: ResizeObserver | undefined

const getSize =
    (
        borderBoxAxis: "inline" | "block",
        svgAxis: "width" | "height",
        htmlAxis: "offsetWidth" | "offsetHeight"
    ) =>
    (target: Element, borderBoxSize?: ReadonlyArray<ResizeObserverSize>) => {
        if (borderBoxSize && borderBoxSize[0]) {
            return borderBoxSize[0][
                (borderBoxAxis + "Size") as keyof ResizeObserverSize
            ]
        } else if (isSVGElement(target) && "getBBox" in target) {
            return (target as SVGGraphicsElement).getBBox()[svgAxis]
        } else {
            return (target as HTMLElement)[htmlAxis]
        }
    }

const getWidth = /*@__PURE__*/ getSize("inline", "width", "offsetWidth")
const getHeight = /*@__PURE__*/ getSize("block", "height", "offsetHeight")

function notifyTarget({ target, borderBoxSize }: ResizeObserverEntry) {
    resizeHandlers.get(target)?.forEach((handler) => {
        handler(target, {
            get width() {
                return getWidth(target, borderBoxSize)
            },
            get height() {
                return getHeight(target, borderBoxSize)
            },
        })
    })
}

function notifyAll(entries: ResizeObserverEntry[]) {
    entries.forEach(notifyTarget)
}

function createResizeObserver() {
    if (typeof ResizeObserver === "undefined") return

    observer = new ResizeObserver(notifyAll)
}

export function resizeElement(
    target: ElementOrSelector,
    handler: ResizeHandler<Element>
) {
    if (!observer) createResizeObserver()

    const elements = resolveElements(target)

    elements.forEach((element) => {
        let elementHandlers = resizeHandlers.get(element)

        if (!elementHandlers) {
            elementHandlers = new Set()
            resizeHandlers.set(element, elementHandlers)
        }

        elementHandlers.add(handler)
        observer?.observe(element)
    })

    return () => {
        elements.forEach((element) => {
            const elementHandlers = resizeHandlers.get(element)

            elementHandlers?.delete(handler)

            if (!elementHandlers?.size) {
                observer?.unobserve(element)
            }
        })
    }
}
