import { getStyleRender, RenderSource } from "../../../effects/style"
import { getSVGValueRender } from "../../../effects/svg"
import type { NodeRender } from "../../../node/MotionNode"
import { cssStyleProperties } from "./build-attrs"

/**
 * The function that writes `key` of a motion SVG component before it
 * has an element, where there is no browser to say which values are
 * CSS properties. The <svg> tag takes styles, bar `viewBox`. Any other
 * tag takes attributes, bar the values that only work as styles.
 */
export const getSVGRender = (
    element: SVGElement,
    node: RenderSource,
    key: string
): NodeRender =>
    (
        element.tagName === "svg"
            ? key !== "viewBox"
            : cssStyleProperties.includes(key)
    )
        ? getStyleRender(element, node, key)
        : getSVGValueRender(element, node, key)
