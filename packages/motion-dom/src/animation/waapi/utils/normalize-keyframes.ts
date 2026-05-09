import { AnyResolvedKeyframe, ValueKeyframesDefinition } from "../../types"

/**
 * Match a unitless `0` length value followed by whitespace, comma, or
 * close paren — i.e. a CSS length-position where `0` is equivalent to `0px`
 * but uses no explicit unit.
 *
 * Used to normalise shape functions (e.g. `inset(0 0px 0 0px)`) so that
 * every length token carries the same unit. Chromium 134 intermittently
 * fails to interpolate `clip-path: inset(...)` keyframes that mix unitless
 * `0` and `0px` lengths — see #3101.
 */
const unitlessZeroLength = /(^|[\s,(])0(?=[\s,)])/g

function addPxToZeros(value: string): string {
    return value.replace(unitlessZeroLength, "$10px")
}

const propsToNormalise = new Set(["clipPath"])

export function normaliseAcceleratedKeyframes(
    name: string,
    keyframes: ValueKeyframesDefinition
): ValueKeyframesDefinition {
    if (!propsToNormalise.has(name)) return keyframes

    if (Array.isArray(keyframes)) {
        return (keyframes as AnyResolvedKeyframe[]).map((keyframe) =>
            typeof keyframe === "string" ? addPxToZeros(keyframe) : keyframe
        ) as ValueKeyframesDefinition
    }

    return typeof keyframes === "string"
        ? (addPxToZeros(keyframes) as ValueKeyframesDefinition)
        : keyframes
}
