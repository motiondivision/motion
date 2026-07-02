import { isCSSVar } from "./is-css-var"

export function getComputedStyle(
    element: HTMLElement | SVGElement,
    name: string
) {
    if (typeof window === "undefined") return ""
    const computedStyle = window.getComputedStyle(element)
    return isCSSVar(name)
        ? computedStyle.getPropertyValue(name)
        : computedStyle[name as any]
}
