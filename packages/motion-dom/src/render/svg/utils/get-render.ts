import {
    getStyleRender,
    RenderSource,
    sharedRender,
} from "../../../effects/style"
import { isCSSVar } from "../../dom/is-css-var"
import type { NodeRender } from "../../../node/MotionNode"
import { numberValueTypes } from "../../../value/types/maps/number"
import { getValueAsType } from "../../../value/types/utils/get-as-type"
import { transformProps } from "../../utils/keys-transform"
import { cssStyleProperties } from "./build-attrs"
import { isSVGTag } from "./is-svg-tag"

const attrKeys: { [key: string]: string } = {
    attrX: "x",
    attrY: "y",
    attrScale: "scale",
}

const sameName = (name: string) => name

/**
 * The function that writes `key` of a motion SVG component. Everything
 * is an attribute, except on the <svg> tag itself and for the values
 * that only work, or that WAAPI writes, as styles.
 *
 * @param attrName - Attributes are named in camel case (`strokeWidth`),
 * which a framework that renders them takes as it is. This gives the
 * name an element takes.
 */
export const getSVGRender = (
    element: SVGElement,
    node: RenderSource,
    key: string,
    attrName: (name: string) => string = sameName
): NodeRender => {
    const { latestValues } = node
    const name = key

    if (
        isSVGTag(element.tagName)
            ? key !== "viewBox"
            : transformProps.has(key) ||
              isCSSVar(key) ||
              key.startsWith("origin") ||
              key.startsWith("transform") ||
              cssStyleProperties.includes(key)
    ) {
        return getStyleRender(element, node, key)
    }

    /**
     * pathLength, pathSpacing and pathOffset are written together, as a
     * dash pattern on a path normalised to a length of 1. Unitless, as
     * Safari scales px values when the page is zoomed.
     */
    if (key.startsWith("path")) {
        return sharedRender(node, "dash", () => () => {
            const { pathLength, pathSpacing = 1, pathOffset = 0 } =
                latestValues
            if (pathLength === undefined) return
            element.setAttribute(attrName("pathLength"), "1")
            element.setAttribute(
                attrName("strokeDashoffset"),
                `${-pathOffset}`
            )
            element.setAttribute(
                attrName("strokeDasharray"),
                `${pathLength} ${pathSpacing}`
            )
        })
    }

    key = attrName(attrKeys[key] || key)

    return () =>
        element.setAttribute(
            key,
            getValueAsType(
                latestValues[name],
                numberValueTypes[name]
            ) as string
        )
}
