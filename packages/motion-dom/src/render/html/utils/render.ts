import type { MotionStyle } from "../../VisualElement"
import { HTMLRenderState } from "../types"

export function renderHTML(
    element: HTMLElement,
    { style, vars }: HTMLRenderState,
    styleProp?: MotionStyle,
    projection?: any
) {
    const elementStyle = element.style

    // If the rendered instance isn't a styleable element (e.g. a custom
    // component forwarded its ref to a non-DOM instance), there's nothing to
    // render to. Bailing out here keeps the render loop from crashing. #2777
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
