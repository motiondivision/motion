import type { MotionStyle } from "../../VisualElement"
import { camelToDash } from "../../dom/utils/camel-to-dash"
import { renderHTML } from "../../html/utils/render"
import { SVGRenderState } from "../types"
import { camelCaseAttributes } from "./camel-case-attrs"

export function renderSVG(
    element: SVGElement,
    renderState: SVGRenderState,
    _styleProp?: MotionStyle,
    projection?: any
) {
    renderHTML(element as any, renderState, undefined, projection)

    for (const key in renderState.attrs) {
        const name = !camelCaseAttributes.has(key) ? camelToDash(key) : key
        const value = renderState.attrs[key]

        /**
         * null marks an attribute a suspended value rendered before.
         */
        value === null
            ? element.removeAttribute(name)
            : element.setAttribute(name, value as string)
    }
}
