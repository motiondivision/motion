import { numberValueTypes } from "../../../value/types/maps/number"
import { getValueAsType } from "../../../value/types/utils/get-as-type"
import { ResolvedValues } from "../../types"
import { transformProps } from "../../utils/keys-transform"
import { buildTransform } from "./build-transform"

export type IndependentTransformProperty = "translate" | "scale" | "rotate"

/**
 * Transform values that map onto the individual CSS transform properties.
 * Each property can run its own hardware-accelerated animation, so x,
 * scale and rotate can animate and be interrupted independently.
 */
export const independentTransformProperty: Record<
    string,
    IndependentTransformProperty
> = {
    x: "translate",
    y: "translate",
    z: "translate",
    scale: "scale",
    scaleX: "scale",
    scaleY: "scale",
    rotate: "rotate",
    rotateZ: "rotate",
}

export const independentTransformProperties: IndependentTransformProperty[] =
    ["translate", "scale", "rotate"]

/**
 * Set by the animation module: before an element with accelerated
 * transforms renders, this checks whether the render would be masked by
 * them and returns whether the element renders through the individual
 * transform properties. Kept as a hook so renderers don't bundle the
 * animation code.
 */
export const transformChannelHooks: {
    /**
     * Whether the element has accelerated transforms.
     */
    has?: (element: Element) => boolean
    render?: (element: Element, values: ResolvedValues) => boolean
    /**
     * Move the element's accelerated transforms to the main thread, e.g.
     * before its layout is measured.
     */
    demote?: (element: Element) => void
} = {}

const isDefault = (value: ResolvedValues[string] | undefined, def = 0) =>
    value === undefined || parseFloat(value as string) === def

/**
 * The browser applies translate, rotate, scale and then transform. Motion's
 * transform shorthand applies translate, scale and then rotate. Uniform
 * scale commutes with rotation, so the only transforms that can't move
 * onto the individual properties are axis scales combined with rotation,
 * plus anything that has no individual property (perspective, skew, 3D
 * rotation) and a literal `transform`.
 */
export function canUseIndependentTransforms(
    values: ResolvedValues,
    extraKey?: string
): boolean {
    let hasAxisScale = false
    let hasScale = false
    let rotations = 0

    const check = (key: string) => {
        if (!transformProps.has(key)) return true

        const property = independentTransformProperty[key]
        if (!property) return false

        if (key === "scale") hasScale = true
        else if (property === "scale") hasAxisScale = true
        else if (property === "rotate") rotations++

        return true
    }

    if (
        values.transform !== undefined ||
        (extraKey && values[extraKey] === undefined && !check(extraKey))
    ) {
        return false
    }

    for (const key in values) {
        if (!check(key)) return false
    }

    return (
        !(hasScale && hasAxisScale) &&
        !(hasAxisScale && rotations) &&
        rotations < 2
    )
}

/**
 * Build the value of one individual transform property from a set of
 * values. Unless `explicit`, default values render as "none" to keep
 * styles clean. Keyframes always need explicit values so WAAPI can
 * interpolate them.
 */
export function buildIndependentTransform(
    values: ResolvedValues,
    property: IndependentTransformProperty,
    explicit = false
): string {
    const read = (key: string, def: string) => {
        const value = values[key]
        return value === undefined
            ? def
            : `${getValueAsType(value, numberValueTypes[key])}`
    }

    if (property === "translate") {
        const { x, y, z } = values
        if (!explicit && isDefault(x) && isDefault(y) && isDefault(z)) {
            return "none"
        }
        let translate = `${read("x", "0px")} ${read("y", "0px")}`
        if (!isDefault(z)) translate += ` ${read("z", "0px")}`
        return translate
    } else if (property === "scale") {
        const { scale, scaleX, scaleY } = values
        if (scale !== undefined) {
            return !explicit && isDefault(scale, 1) ? "none" : read("scale", "1")
        }
        if (!explicit && isDefault(scaleX, 1) && isDefault(scaleY, 1)) {
            return "none"
        }
        return `${read("scaleX", "1")} ${read("scaleY", "1")}`
    } else {
        const key = values.rotate !== undefined ? "rotate" : "rotateZ"
        return !explicit && isDefault(values[key]) ? "none" : read(key, "0deg")
    }
}

/**
 * Write the transform styles for `values` into `style`: through the
 * individual properties while the element has accelerated transforms,
 * otherwise through the transform shorthand. The individual properties
 * are cleared when not in use so the two never combine.
 */
export function applyTransformStyles(
    values: ResolvedValues,
    style: ResolvedValues,
    independent: boolean
) {
    if (independent) {
        style.transform = "none"
        for (const property of independentTransformProperties) {
            style[property] = buildIndependentTransform(values, property)
        }
    } else {
        style.transform = buildTransform(values, {})
        for (const property of independentTransformProperties) {
            style[property] = ""
        }
    }
}
