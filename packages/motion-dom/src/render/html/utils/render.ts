import type { MotionStyle } from "../../VisualElement"
import { HTMLRenderState } from "../types"

export function renderHTML(
    element: HTMLElement,
    { style, vars }: HTMLRenderState,
    styleProp?: MotionStyle,
    projection?: any
) {
    const elementStyle = element.style

    /**
     * When projection is going to write a transform it owns (and
     * incorporates) the user transform, so skip writing it here. This
     * avoids a doubled CSSOM write per projecting element per frame and
     * keeps projection's memoized transform writes valid.
     */
    const projectionWillWriteTransform = projection
        ? projection.willProjectTransform()
        : false

    let key: string
    for (key in style) {
        if (
            projectionWillWriteTransform &&
            (key === "transform" || key === "transformOrigin")
        ) {
            continue
        }

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
