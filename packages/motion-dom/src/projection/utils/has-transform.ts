import { type AnyResolvedKeyframe } from "../../animation/types"
import { ResolvedValues } from "../../render/types"

/**
 * "none" is the default value of every transform, so it's treated as unset
 * rather than as a value to render or do box arithmetic with.
 */
export const unlessNone = <T>(value: T) =>
    value === "none" ? undefined : value

function isIdentityScale(scale: AnyResolvedKeyframe | undefined) {
    scale = unlessNone(scale)
    return scale === undefined || scale === 1
}

export function hasScale({ scale, scaleX, scaleY }: ResolvedValues) {
    return (
        !isIdentityScale(scale) ||
        !isIdentityScale(scaleX) ||
        !isIdentityScale(scaleY)
    )
}

export function hasTransform(values: ResolvedValues) {
    return (
        hasScale(values) ||
        has2DTranslate(values) ||
        unlessNone(values.z) ||
        unlessNone(values.rotate) ||
        unlessNone(values.rotateX) ||
        unlessNone(values.rotateY) ||
        unlessNone(values.skewX) ||
        unlessNone(values.skewY)
    )
}

export function has2DTranslate(values: ResolvedValues) {
    return is2DTranslate(values.x) || is2DTranslate(values.y)
}

function is2DTranslate(value: AnyResolvedKeyframe | undefined) {
    return unlessNone(value) && value !== "0%"
}
