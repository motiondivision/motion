import { getValueAsType } from "../../../value/types/utils/get-as-type"
import { numberValueTypes } from "../../../value/types/maps/number"
import { transformPropOrder, transformProps } from "../../utils/keys-transform"
import { isCSSVariableName } from "../../../animation/utils/is-css-variable"
import { ResolvedValues } from "../../types"
import { HTMLRenderState } from "../types"
import {
    buildTransformFrom,
    TransformTemplate,
} from "../../../effects/style/transform"
import type { MotionNodeOptions } from "../../../node/types"

/**
 * Build the styles a set of plain values renders to, for the initial
 * (and server) render, before the style effect takes over.
 */
export function buildHTMLStyles(
    state: HTMLRenderState,
    latestValues: ResolvedValues,
    transformTemplate?: MotionNodeOptions["transformTemplate"]
) {
    const { style, vars, transformOrigin } = state

    let hasTransform = false
    let hasTransformOrigin = false

    for (const key in latestValues) {
        const value = latestValues[key]

        if (transformProps.has(key)) {
            hasTransform = true
        } else if (isCSSVariableName(key)) {
            vars[key] = value
        } else {
            const valueAsType = getValueAsType(value, numberValueTypes[key])

            if (key.startsWith("origin")) {
                hasTransformOrigin = true
                transformOrigin[key as keyof typeof transformOrigin] =
                    valueAsType
            } else {
                style[key] = valueAsType
            }
        }
    }

    if (!latestValues.transform) {
        if (hasTransform || transformTemplate) {
            style.transform = buildTransformFrom(
                transformPropOrder,
                (key) => latestValues[key],
                transformTemplate as TransformTemplate | undefined
            )!
        } else if (style.transform) {
            style.transform = "none"
        }
    }

    if (hasTransformOrigin) {
        const {
            originX = "50%",
            originY = "50%",
            originZ = 0,
        } = transformOrigin
        style.transformOrigin = `${originX} ${originY} ${originZ}`
    }
}
