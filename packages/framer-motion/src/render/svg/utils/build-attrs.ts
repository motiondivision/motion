import { MotionProps } from "../../../motion/types"
import { buildHTMLStyles } from "../../html/utils/build-styles"
import { ResolvedValues } from "../../types"
import { SVGRenderState } from "../types"
import { buildSVGPath } from "./path"

/**
 * Build SVG visual attrbutes, like cx and style.transform
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
    transformTemplate?: MotionProps["transformTemplate"],
    styleProp?: MotionProps["style"]
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

    // Render attrX/attrY/attrScale as attributes
    if (attrX !== undefined) attrs.x = attrX
    if (attrY !== undefined) attrs.y = attrY
    if (attrScale !== undefined) attrs.scale = attrScale

    // Build SVG path if one has been defined
    if (pathLength !== undefined) {
        buildSVGPath(
            attrs,
            pathLength as number,
            pathSpacing as number,
            pathOffset as number,
            false
        )
    }
}
