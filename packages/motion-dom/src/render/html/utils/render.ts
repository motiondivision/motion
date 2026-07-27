import type { MotionStyle } from "../../VisualElement"
import { HTMLRenderState } from "../types"

export function renderHTML(
    element: HTMLElement,
    { style, vars }: HTMLRenderState,
    styleProp?: MotionStyle,
    projection?: any
) {
    const elementStyle = element.style

    // A non-styleable instance throws a "custom-component-ref" invariant on
    // mount in development. In production we bail rather than take the whole
    // render loop down with it. #2777
    if (!elementStyle) return

    let key: string
    for (key in style) {
        // CSSStyleDeclaration has [index: number]: string; in the types, so we use that as key type.
        elementStyle[key as unknown as number] = style[key] as string
    }

    // Write projection styles directly to element style
    projection?.applyProjectionStyles(elementStyle, styleProp)

    for (key in vars) {
        // Loop over any CSS variables and assign those.
        // They can only be assigned using `setProperty`.
        elementStyle.setProperty(key, vars[key] as string)
    }
}
