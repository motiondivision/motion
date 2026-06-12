import { transformPropOrder } from "../../render/utils/keys-transform"
import { ResolvedValues } from "../../render/types"
import { isHTMLElement } from "../../utils/is-html-element"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import type { MotionValueState } from "../MotionValueState"

const translateAlias = {
    x: "translateX",
    y: "translateY",
    z: "translateZ",
    transformPerspective: "perspective",
}

const numTransforms = transformPropOrder.length

/**
 * Build a CSS transform style from individual x/y/scale etc properties.
 *
 * This outputs with a default order of transforms/scales/rotations.
 *
 * Optionally provide a transformValues object - all present transform values,
 * including defaults, are coerced and copied into it for consumption by a
 * transformTemplate.
 */
export function buildTransform(
    latestValues: ResolvedValues,
    transformValues?: ResolvedValues
) {
    // The transform string we're going to build into.
    let transformString = ""
    let transformIsDefault = true

    /**
     * Loop over all possible transforms in order, adding the ones that
     * are present to the transform string.
     */
    for (let i = 0; i < numTransforms; i++) {
        const key = transformPropOrder[i] as keyof typeof translateAlias
        const value = latestValues[key]

        if (value === undefined) continue

        let valueIsDefault = true
        if (typeof value === "number") {
            valueIsDefault = value === (key.startsWith("scale") ? 1 : 0)
        } else {
            const parsed = parseFloat(value)
            valueIsDefault = key.startsWith("scale") ? parsed === 1 : parsed === 0
        }

        if (!valueIsDefault || transformValues) {
            const valueAsType = getValueAsType(value, numberValueTypes[key])

            if (!valueIsDefault) {
                transformIsDefault = false
                const transformName = translateAlias[key] || key
                transformString += `${transformName}(${valueAsType}) `
            }

            if (transformValues) {
                transformValues[key] = valueAsType
            }
        }
    }

    // `pathRotation` composes onto `rotate` as a separate additive term so
    // the user's `rotate` is never clobbered. Deliberately not a slot in
    // `transformPropOrder`.
    const pathRotation = latestValues.pathRotation
    if (pathRotation) {
        transformIsDefault = false
        transformString += `rotate(${getValueAsType(
            pathRotation,
            numberValueTypes.pathRotation
        )}) `
    }

    return transformIsDefault ? "none" : transformString.trim()
}

/**
 * Render the composed transform for an element, applying SVG-specific
 * defaults for transform-box and transform-origin. Falls back to building
 * directly from latest values when no transform slot exists, e.g. full
 * renders of projection-driven elements.
 *
 * SVG renderers pass isSVG explicitly - the element may live in the HTML
 * namespace (e.g. an SVG tag rendered outside an <svg> root), where
 * instance checks misreport it.
 */
export function renderTransform(
    element: HTMLElement | SVGElement,
    state: MotionValueState,
    isSVG = !isHTMLElement(element)
) {
    const { latest } = state

    element.style.transform = (state.build("transform") ??
        buildTransform(latest)) as string

    if (isSVG) {
        /**
         * SVG transforms are normalised against the element's bounding box
         * with fill-box, and originate from the element's median, unless
         * otherwise provided.
         */
        if (latest.transformBox === undefined) {
            element.style.transformBox = "fill-box"
        }

        if (
            latest.originX === undefined &&
            latest.originY === undefined &&
            latest.originZ === undefined
        ) {
            element.style.transformOrigin = "50% 50%"
        }
    }
}

export function renderTransformOrigin(
    element: HTMLElement | SVGElement,
    state: MotionValueState
) {
    element.style.transformOrigin = (state.build("transformOrigin") ??
        buildTransformOrigin(state.latest)) as string
}

/**
 * Build a CSS transform-origin style from individual originX/Y/Z properties,
 * using the same defaults as the browser for undefined origins.
 */
export function buildTransformOrigin(latestValues: ResolvedValues) {
    const { originX, originY, originZ } = latestValues

    // Only coerce provided values - defaults render unitless, as per browser defaults
    return `${
        originX !== undefined
            ? getValueAsType(originX, numberValueTypes.originX)
            : "50%"
    } ${
        originY !== undefined
            ? getValueAsType(originY, numberValueTypes.originY)
            : "50%"
    } ${
        originZ !== undefined
            ? getValueAsType(originZ, numberValueTypes.originZ)
            : 0
    }`
}
