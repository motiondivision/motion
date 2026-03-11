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
     * Motion-synthesized transforms (from x/y/scale/rotate props) are applied as CSS
     * transforms. If the user has explicitly provided a `transform` value — whether
     * as a MotionValue prop or via `animate={{ transform }}` — we keep it as an SVG
     * attribute. This allows SVG-syntax values (e.g. "rotate(45)" without units) to
     * render correctly, and ensures the resolved string overrides any MotionValue
     * object that would otherwise leak into the DOM from React's filteredProps.
     */
    if (attrs.transform) {
        if (latest.transform === undefined) {
            style.transform = attrs.transform
            delete attrs.transform
        }
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
