import {
    getStyleRender,
    RenderSource,
    sharedRender,
} from "../../../effects/style"
import type { NodeRender } from "../../../node/MotionNode"
import { numberValueTypes } from "../../../value/types/maps/number"
import { getValueAsType } from "../../../value/types/utils/get-as-type"
import { transformProps } from "../../utils/keys-transform"

const attrKeys: { [key: string]: string } = {
    attrX: "x",
    attrY: "y",
    attrScale: "scale",
}

const sameName = (name: string) => name

/**
 * Values written as styles: CSS variables, origins, `transform` and its
 * box and origin, and the values WAAPI can accelerate, as WAAPI writes
 * its final value to style, which would override an attribute.
 */
const isSVGStyle =
    /^(--|origin|transform|opacity$|clipPath$|filter$|offset[DPRA])/u

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
        element.tagName === "svg"
            ? key !== "viewBox"
            : transformProps.has(key) || isSVGStyle.test(key)
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
            element.setAttribute(attrName("pathLength"), 1 as any)
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
