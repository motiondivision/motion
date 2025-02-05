type MotionStyleKey = Exclude<
    keyof CSSStyleDeclaration,
    "length" | "parentRule"
>

export function setCSSVar(
    element: HTMLElement,
    name: string,
    value: string | number
) {
    element.style.setProperty(name, value as string)
}

export function setStyle(
    element: HTMLElement,
    name: string,
    value: string | number
) {
    element.style[name as MotionStyleKey] = value as any
}
