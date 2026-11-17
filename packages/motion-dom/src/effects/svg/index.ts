import type { MotionNode, NodeRender } from "../../node/MotionNode"
import { isCSSVar } from "../../render/dom/is-css-var"
import { camelToDash } from "../../render/dom/utils/camel-to-dash"
import { nodeStore } from "../../render/store"
import { cssStyleProperties } from "../../render/svg/utils/build-attrs"
import { transformProps } from "../../render/utils/keys-transform"
import { MotionValue } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getAttrRender } from "../attr"
import {
    getStyleRender,
    readStyleValue,
    RenderSource,
    sharedRender,
} from "../style"
import { createSelectorEffect } from "../utils/create-dom-effect"
import { createEffect } from "../utils/create-effect"

/**
 * Whether `key` is written to an SVG element's style whatever the
 * browser supports as a CSS property.
 */
export const isSVGStyle = (key: string) =>
    transformProps.has(key) || key.startsWith("origin") || isCSSVar(key)

/**
 * The function that writes `key` to an SVG element. It's a style if the
 * browser has it as a CSS property, and an attribute otherwise.
 */
export const getSVGValueRender = (
    element: SVGElement,
    node: RenderSource,
    key: string
): NodeRender => {
    const { latestValues } = node

    /**
     * pathLength, pathSpacing and pathOffset are a dash pattern on a
     * path normalised to a length of 1. Unitless, as Safari scales px
     * values when the page is zoomed.
     */
    if (key.startsWith("path") && !transformProps.has(key)) {
        return key === "pathOffset"
            ? () => {
                  element.setAttribute("pathLength", "1")
                  element.setAttribute(
                      "stroke-dashoffset",
                      `${-(latestValues.pathOffset as number)}`
                  )
              }
            : sharedRender(node, "dash", () => () => {
                  const { pathLength = 1, pathSpacing } = latestValues

                  element.setAttribute("pathLength", "1")
                  element.setAttribute(
                      "stroke-dasharray",
                      `${pathLength} ${pathSpacing ?? 1 - Number(pathLength)}`
                  )
              })
    }

    if (key.startsWith("attr")) {
        return getAttrRender(element, node, key, convertAttrKey(key))
    }

    if (key === "d") {
        /**
         * `d` is a CSS property in Chrome and Firefox, but only as
         * `path(...)`, so path data goes to the attribute, taken out of
         * `path(...)` if it's written that way. Path data itself has no
         * quotes or brackets.
         */
        return () => {
            const d = (latestValues.d as string | undefined)?.replace(
                /path\(|["')]/g,
                ""
            )
            d === undefined
                ? element.removeAttribute(key)
                : element.setAttribute(key, d)
        }
    }

    /**
     * Transforms and origins aren't CSS properties (bar `x`/`y` in some
     * browsers), so check them by name rather than `key in element.style`.
     * `offset` is a CSS property for motion paths, but on a gradient
     * stop it's the attribute.
     */
    return (
        isSVGStyle(key) ||
            (key in element.style &&
                !(key === "offset" && element.tagName === "stop"))
            ? getStyleRender
            : getAttrRender
    )(element, node, key)
}

export const addSVGValue = (
    element: SVGElement,
    node: MotionNode,
    key: string,
    value?: MotionValue
) => node.set(key, value, getSVGValueRender(element, node, key))

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
 * a node with a direct `svgEffect()` call. `animate()` attaches the `test`
 * and `read` hooks, as for the style effect.
 */
export const svgSubjectEffect = /*@__PURE__*/ createEffect(addSVGValue, {
    nodes: nodeStore,
})

export const svgEffect = /*@__PURE__*/ createSelectorEffect(svgSubjectEffect)

function convertAttrKey(key: string) {
    return key.replace(/^attr([A-Z])/, (_, firstChar) =>
        firstChar.toLowerCase()
    )
}
