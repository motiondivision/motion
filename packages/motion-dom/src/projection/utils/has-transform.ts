import { type AnyResolvedKeyframe } from "../../animation/types"
import { ResolvedValues } from "../../render/types"

function isIdentityScale(scale: AnyResolvedKeyframe | undefined) {
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
