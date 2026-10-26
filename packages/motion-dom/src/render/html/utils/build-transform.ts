import { getValueAsType } from "../../../value/types/utils/get-as-type"
import { numberValueTypes } from "../../../value/types/maps/number"
import { transformValueTypes } from "../../../value/types/maps/transform"
import type { AnyResolvedKeyframe } from "../../../animation/types"
import { transformPropOrder } from "../../utils/keys-transform"
import { ResolvedValues } from "../../types"
import { HTMLRenderState } from "../types"
import type { MotionNodeOptions } from "../../../node/types"

export const translateAlias: Record<string, string> = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective",
}

const numTransforms = transformPropOrder.length

/**
 * Cache of `translateX(`-style openers so each transform function is a few
 * string concatenations rather than a template.
 */
const openers: Record<string, string> = {}

/**
 * A transform function, e.g. `translateX(10px)` for `x: 10`.
 */
export const transformFunction = (key: string, value: AnyResolvedKeyframe) =>
    (openers[key] ||= (translateAlias[key] || key) + "(") +
    getValueAsType(value, transformValueTypes[key]) +
    ")"

/**
 * Whether a transform value is at its default, so can be left out.
 */
export const isDefaultTransform = (key: string, value: AnyResolvedKeyframe) =>
    (typeof value === "number" ? value : parseFloat(value)) ===
    (key.startsWith("scale") ? 1 : 0)

/**
 * Build a CSS transform style from individual x/y/scale etc properties.
 *
 * This outputs with a default order of transforms/scales/rotations, this can be customised by
 * providing a transformTemplate function.
 */
export function buildTransform(
    latestValues: ResolvedValues,
    transform: HTMLRenderState["transform"],
    transformTemplate?: MotionNodeOptions["transformTemplate"]
) {
    // The transform string we're going to build into.
    let transformString = ""

    /**
     * Loop over all possible transforms in order, adding the ones that
     * are present to the transform string.
     */
    for (let i = 0; i < numTransforms; i++) {
        const key = transformPropOrder[i]
        const value = latestValues[key]

        if (value === undefined) continue

        if (!isDefaultTransform(key, value)) {
            transformString += transformFunction(key, value) + " "
        }

        if (transformTemplate) {
            transform[key] = getValueAsType(value, numberValueTypes[key])
        }
    }

    // `pathRotation` composes onto `rotate` as a separate additive term so
    // the user's `rotate` is never clobbered. Deliberately not a slot in
    // `transformPropOrder`.
    const pathRotation = latestValues.pathRotation
    if (pathRotation) {
        transformString += transformFunction("rotate", pathRotation)
    }

    transformString = transformString.trim()

    // If we have a custom `transform` template, pass our transform values and
    // generated transformString to that before returning
    return transformTemplate
        ? transformTemplate(transform, transformString)
        : transformString || "none"
}
