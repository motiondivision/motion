import type { MotionNodeOptions } from "../../../node/types"
import { buildHTMLStyles } from "../../html/utils/build-styles"
import { ResolvedValues } from "../../types"
import { SVGRenderState } from "../types"
import { buildSVGPath } from "./path"

/**
 * CSS Motion Path properties that should remain as CSS styles on SVG elements.
 */
const cssMotionPathProperties = [
    "offsetDistance",
    "offsetPath",
    "offsetRotate",
    "offsetAnchor",
]

/**
 * Build SVG visual attributes, like cx and style.transform
 */
export function buildSVGAttrs(
    state: SVGRenderState,
    {
        attrX,
        attrY,
        attrScale,
        pathLength,
        pathSpacing = 1,
        pathOffset = 0,
        // This is object creation, which we try to avoid per-frame.
        ...latest
    }: ResolvedValues,
    isSVGTag: boolean,
    transformTemplate?: MotionNodeOptions["transformTemplate"],
    styleProp?: Record<string, any>
) {
    buildHTMLStyles(state, latest, transformTemplate)

    /**
     * For svg tags we just want to make sure viewBox is animatable and treat all the styles
     * as normal HTML tags.
     */
    if (isSVGTag) {
        if (state.style.viewBox) {
            state.attrs.viewBox = state.style.viewBox
        }
        return
    }

    state.attrs = state.style
    state.style = {}
    const { attrs, style } = state

    /**
     * However, we apply transforms as CSS transforms.
     * So if we detect a transform, transformOrigin we take it from attrs and copy it into style.
     */
    if (attrs.transform) {
        style.transform = attrs.transform
        delete attrs.transform
    }
    if (style.transform || attrs.transformOrigin) {
        style.transformOrigin = attrs.transformOrigin ?? "50% 50%"
        delete attrs.transformOrigin
    }

    if (style.transform) {
        /**
         * SVG's element transform-origin uses its own median as a reference.
         * Therefore, transformBox becomes a fill-box
         */
        style.transformBox = (styleProp?.transformBox as string) ?? "fill-box"
        delete attrs.transformBox
    }

    for (const key of cssMotionPathProperties) {
        if (attrs[key] !== undefined) {
            style[key] = attrs[key]
            delete attrs[key]
        }
    }

    // Render attrX/attrY/attrScale as attributes
    if (attrX !== undefined) attrs.x = attrX
    if (attrY !== undefined) attrs.y = attrY
    if (attrScale !== undefined) attrs.scale = attrScale

    // Build SVG path if one has been defined and user hasn't provided their own strokeDasharray.
    // When a user provides strokeDasharray for styling (e.g., dashed lines), we shouldn't
    // override it with our pathLength-based strokeDasharray, as that would also require
    // setting pathLength="1" on the element, which changes how their dash values are interpreted.
    if (pathLength !== undefined && attrs.strokeDasharray === undefined) {
        buildSVGPath(
            attrs,
            pathLength as number,
            pathSpacing as number,
            pathOffset as number,
            false
        )
    }
}
