import { UnresolvedValueKeyframe } from "../../types"

/**
 * A keyframe like "+=100" or "-=10px" is relative to the keyframe before it.
 */
export const isRelativeKeyframe = (keyframe: unknown): keyframe is string =>
    (keyframe as string)?.[1] === "="

const unitOf = (value: unknown) =>
    (value + "").replace(/^[-+\d.]+(e[-+]?\d+)?/, "")

/**
 * Resolve a relative keyframe against `origin`. It takes the offset's unit,
 * or the origin's if the offset has none.
 */
export function resolveRelative(
    keyframe: UnresolvedValueKeyframe,
    origin: UnresolvedValueKeyframe
) {
    if (!isRelativeKeyframe(keyframe)) return keyframe

    const offset = keyframe.replace("=", "")
    const value = parseFloat(origin as string) + parseFloat(offset)
    const unit = unitOf(offset) || unitOf(origin)

    return unit ? value + unit : value
}

/**
 * Like fillWildcards, fill null keyframes with the keyframe before them,
 * and also resolve relative keyframes against it.
 *
 * Kept apart from fillWildcards so animate() from "motion/mini" doesn't
 * include it.
 */
export function fillRelativeWildcards(keyframes: UnresolvedValueKeyframe[]) {
    for (let i = 1; i < keyframes.length; i++) {
        keyframes[i] = resolveRelative(
            keyframes[i] ?? keyframes[i - 1],
            keyframes[i - 1]
        )
    }
}
