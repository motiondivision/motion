import { MotionStyle } from "../../.."
import { IProjectionNode } from "../../../projection/node/types"
import { HTMLRenderState } from "../types"

export function renderHTML(
    element: HTMLElement,
    { style, vars }: HTMLRenderState,
    styleProp?: MotionStyle,
    projection?: IProjectionNode
) {
    const elementStyle = element.style
    let key: string
    for (key in style) {
        // CSSStyleDeclaration has [index: number]: string; in the types, so we use that as key type.
        elementStyle[key as unknown as number] = style[key] as string
    }

    // this writes to elementStyle
    projection?.getProjectionStyles(styleProp, elementStyle)

    for (key in vars) {
        // Loop over any CSS variables and assign those.
        // They can only be assigned using `setProperty`.
        elementStyle.setProperty(key, vars[key] as string)
    }
}
