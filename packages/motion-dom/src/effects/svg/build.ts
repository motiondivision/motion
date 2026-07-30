import type { MotionNodeOptions } from "../../node/types"
import { ResolvedValues } from "../../render/types"
import { buildStyles } from "../style/build"

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
 * Build static SVG visual attributes and styles from a set of latest values,
 * like cx and style.transform. Used to generate props for the initial React
 * render, where values are applied by the framework rather than imperative
 * effects (SSR-safe).
 */
export function buildSVGProps(
    latestValues: ResolvedValues,
    isSVGTag: boolean,
    transformTemplate?: MotionNodeOptions["transformTemplate"],
    styleProp?: Record<string, any>
): { attrs: ResolvedValues; style: ResolvedValues } {
    const {
        attrX,
        attrY,
        attrScale,
        pathLength,
        pathSpacing = 1,
        pathOffset = 0,
        // This is object creation, which we try to avoid per-frame.
        ...latest
    } = latestValues

    let style = buildStyles(latest, transformTemplate)
    let attrs: ResolvedValues = {}

    /**
     * For svg tags we just want to make sure viewBox is animatable and treat all the styles
     * as normal HTML tags.
     */
    if (isSVGTag) {
        if (style.viewBox) {
            attrs.viewBox = style.viewBox
        }

        return { attrs, style }
    }

    attrs = style
    style = {}

    /**
     * However, we apply transforms as CSS transforms.
     * So if we detect a transform, transformOrigin we take it from attrs and copy it into style.
     */
    if (attrs.transform) {
        style.transform = attrs.transform
        delete attrs.transform
    }
    if (style.transform || attrs.transformOrigin) {
        style.transformOrigin = (attrs.transformOrigin as string) ?? "50% 50%"
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
        // Normalise path length by setting SVG attribute pathLength to 1
        attrs.pathLength = 1

        // Use unitless values to avoid Safari zoom bug
        attrs.strokeDashoffset = `${-pathOffset}`
        attrs.strokeDasharray = `${pathLength} ${pathSpacing}`
    }

    return { attrs, style }
}
