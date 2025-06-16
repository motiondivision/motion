import { isCSSVar } from "./is-css-var"

export function setStyle(
    element: HTMLElement | SVGElement,
    name: string,
    value: string | number
) {
    isCSSVar(name)
        ? element.style.setProperty(name, value as string)
        : (element.style[name as any] = value as string)
}
