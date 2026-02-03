import type { MotionStyle } from "../../VisualElement"
import { camelToDash } from "../../dom/utils/camel-to-dash"
import {
    getCachedAttrs,
    isFrameCacheActive,
    setCachedAttrs,
} from "../../frame-cache"
import { renderHTML } from "../../html/utils/render"
import { SVGRenderState } from "../types"
import { camelCaseAttributes } from "./camel-case-attrs"

export function renderSVG(
    element: SVGElement,
    renderState: SVGRenderState,
    _styleProp?: MotionStyle,
    projection?: any
) {
    // renderHTML handles its own style caching
    renderHTML(element as any, renderState, undefined, projection)

    if (isFrameCacheActive()) {
        const cachedAttrs = getCachedAttrs(element)
        if (cachedAttrs) {
            for (const key in cachedAttrs) {
                element.setAttribute(key, cachedAttrs[key])
            }
            return
        }
    }

    const attrRecord: Record<string, string> = {}
    for (const key in renderState.attrs) {
        const attrName = !camelCaseAttributes.has(key)
            ? camelToDash(key)
            : key
        const value = renderState.attrs[key] as string
        element.setAttribute(attrName, value)
        attrRecord[attrName] = value
    }

    if (isFrameCacheActive()) {
        setCachedAttrs(element, attrRecord)
    }
}
