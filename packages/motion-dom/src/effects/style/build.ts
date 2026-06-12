import type { MotionNodeOptions } from "../../node/types"
import { buildTransform as buildTransformWithTemplate } from "../../render/html/utils/build-transform"
import { ResolvedValues } from "../../render/types"
import { transformProps } from "../../render/utils/keys-transform"
import { isCSSVar } from "../../render/dom/is-css-var"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { originProps } from "./index"
import { buildTransformOrigin } from "./transform"

/**
 * Build a static style object from a set of latest values. Used to generate
 * styles for the initial React render, where styles are applied by the
 * framework rather than imperative effects (SSR-safe).
 */
export function buildStyles(
    latestValues: ResolvedValues,
    transformTemplate?: MotionNodeOptions["transformTemplate"]
): ResolvedValues {
    const style: ResolvedValues = {}
    let hasTransform = false
    let hasOrigin = false

    // CSS variables are written first to match prior SSR output ordering
    for (const key in latestValues) {
        if (isCSSVar(key)) {
            style[key] = latestValues[key]
        }
    }

    for (const key in latestValues) {
        if (transformProps.has(key)) {
            hasTransform = true
        } else if (originProps.has(key)) {
            hasOrigin = true
        } else if (!isCSSVar(key)) {
            style[key] = getValueAsType(
                latestValues[key],
                numberValueTypes[key]
            )
        }
    }

    if (!latestValues.transform && (hasTransform || transformTemplate)) {
        style.transform = buildTransformWithTemplate(
            latestValues,
            {},
            transformTemplate
        )
    }

    if (hasOrigin) {
        style.transformOrigin = buildTransformOrigin(latestValues)
    }

    return style
}
