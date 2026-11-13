import { frame } from "../../frameloop"
import type { MotionNode } from "../../node/MotionNode"
import { isCSSVar } from "../../render/dom/is-css-var"
import { camelToDash } from "../../render/dom/utils/camel-to-dash"
import { nodeStore } from "../../render/store"
import { cssStyleProperties } from "../../render/svg/utils/build-attrs"
import { transformProps } from "../../render/utils/keys-transform"
import { isSVGElement } from "../../utils/is-svg-element"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { addAttrValue } from "../attr"
import { addStyleValue, originProps, readStyleValue } from "../style"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

function addSVGPathValue(
    element: SVGElement,
    node: MotionNode,
    key: string,
    value?: MotionValue
) {
    frame.render(() => element.setAttribute("pathLength", "1"))

    const { latestValues } = node

    if (key === "pathOffset") {
        return node.set(key, value, () => {
            // Use unitless value to avoid Safari zoom bug
            element.setAttribute(
                "stroke-dashoffset",
                `${-(latestValues.pathOffset as number)}`
            )
        })
    }

    return node.set(
        key,
        value,
        ((node.shared ||= {}).dash ||= () => {
            const { pathLength = 1, pathSpacing } = latestValues

            // Use unitless values to avoid Safari zoom bug
            element.setAttribute(
                "stroke-dasharray",
                `${pathLength} ${pathSpacing ?? 1 - Number(pathLength)}`
            )
        }),
        true
    )
}

/**
 * Whether `key` is written to an SVG element's style whatever the
 * browser supports as a CSS property.
 */
export const isSVGStyle = (key: string) =>
    transformProps.has(key) || originProps.has(key) || isCSSVar(key)

export const addSVGValue = (
    element: SVGElement,
    node: MotionNode,
    key: string,
    value?: MotionValue
) => {
    if (key.startsWith("path") && !transformProps.has(key)) {
        return addSVGPathValue(element, node, key, value)
    } else if (key.startsWith("attr")) {
        return addAttrValue(element, node, key, value, convertAttrKey(key))
    } else if (key === "d") {
        /**
         * `d` is a CSS property in Chrome and Firefox, but only as
         * `path(...)`, so path data goes to the attribute, taken out of
         * `path(...)` if it's written that way. Path data itself has no
         * quotes or brackets.
         */
        return node.set(key, value, () => {
            const d = (node.latestValues.d as string | undefined)?.replace(
                /path\(|["')]/g,
                ""
            )
            d === undefined
                ? element.removeAttribute(key)
                : element.setAttribute(key, d)
        })
    }

    /**
     * Transforms and origins aren't CSS properties (bar `x`/`y` in some
     * browsers), so check them by name rather than `key in element.style`.
     */
    const handler =
        isSVGStyle(key) || key in element.style ? addStyleValue : addAttrValue
    return handler(element, node, key, value)
}

/**
 * Reads the current value of `key` from an SVG element as the origin of
 * an animation: transforms start from their defaults, CSS variables and
 * the few CSS-only properties come from computed style, falling back to
 * the attribute when that's empty (e.g. the element isn't rendered), and
 * everything else is read from the attribute, dash-cased (`strokeWidth`
 * -> `stroke-width`) or, failing that, as written (`baseFrequency`).
 */
export const readSVGValue = (element: SVGElement, key: string) => {
    if (transformProps.has(key)) {
        return numberValueTypes[key]?.default || 0
    }

    if (isCSSVar(key) || cssStyleProperties.includes(key)) {
        return (
            readStyleValue(element, key) ||
            element.getAttribute(camelToDash(key)) ||
            0
        )
    }

    key = convertAttrKey(key)

    return (
        element.getAttribute(camelToDash(key)) ??
        element.getAttribute(key) ??
        undefined
    )
}

/**
 * The per-element effect `animate()` binds through, so SVG values share
 * a node with a direct `svgEffect()` call.
 */
export const svgSubjectEffect = /*@__PURE__*/ createEffect(addSVGValue, {
    test: isSVGElement,
    read: readSVGValue,
    nodes: nodeStore,
})

export const svgEffect = /*@__PURE__*/ createSelectorEffect(svgSubjectEffect)

function convertAttrKey(key: string) {
    return key.replace(/^attr([A-Z])/, (_, firstChar) =>
        firstChar.toLowerCase()
    )
}
