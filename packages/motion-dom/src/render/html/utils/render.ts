import type { MotionStyle } from "../../VisualElement"
import {
    getCachedStyles,
    isFrameCacheActive,
    setCachedStyles,
} from "../../frame-cache"
import { HTMLRenderState } from "../types"

export function renderHTML(
    element: HTMLElement,
    { style, vars }: HTMLRenderState,
    styleProp?: MotionStyle,
    projection?: any
) {
    const elementStyle = element.style

    // Cache hit: apply cached styles, skip all computation
    if (isFrameCacheActive()) {
        const cached = getCachedStyles(element)
        if (cached) {
            for (const key in cached) {
                if (key.startsWith("--")) {
                    elementStyle.setProperty(key, cached[key])
                } else {
                    elementStyle[key as unknown as number] = cached[key]
                }
            }
            return
        }
    }

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

    // Cache the result after render
    if (isFrameCacheActive()) {
        const record: Record<string, string> = {}
        for (key in style) {
            record[key] = elementStyle[key as unknown as number]
        }
        for (key in vars) {
            record[key] = elementStyle.getPropertyValue(key)
        }
        // Capture projection-applied properties
        if (projection) {
            record["transform"] = elementStyle.transform
            record["transformOrigin"] = elementStyle.transformOrigin
            if (elementStyle.opacity) record["opacity"] = elementStyle.opacity
        }
        setCachedStyles(element, record)
    }
}
