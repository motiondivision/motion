import { type AnyResolvedKeyframe } from "../../animation/types"
import { ResolvedValues } from "../../render/types"

function isIdentityScale(scale: AnyResolvedKeyframe | undefined) {
    if (scale === undefined || scale === 1) return true
    if (typeof scale !== "string") return false
    // CSS scale() treats 100% as 1; anything else is a no-op string that
    // would NaN-poison the layout box if applied.
    const parsed = parseFloat(scale)
    return scale.endsWith("%") ? parsed === 100 : parsed === 1
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
        values.z ||
        values.rotate ||
        values.rotateX ||
        values.rotateY ||
        values.skewX ||
        values.skewY
    )
}

export function has2DTranslate(values: ResolvedValues) {
    return is2DTranslate(values.x) || is2DTranslate(values.y)
}

function is2DTranslate(value: AnyResolvedKeyframe | undefined) {
    return value && value !== "0%"
}
