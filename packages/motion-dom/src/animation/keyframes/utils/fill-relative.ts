import { UnresolvedValueKeyframe } from "../../types"

/**
 * A keyframe like "+=100" or "-=10px" is relative to the keyframe before it.
 */
export const isRelativeKeyframe = (keyframe: unknown): keyframe is string =>
    (keyframe as string)?.[1] === "="

const unitOf = (value: unknown) => (value + "").replace(/^[-+\d.]+/, "")

/**
 * Like fillWildcards, fill null keyframes with the keyframe before them,
 * and also resolve relative keyframes against it. A relative keyframe takes
 * its offset's unit, or the previous keyframe's if the offset has none.
 *
 * Kept apart from fillWildcards so animate() from "motion/mini" doesn't
 * include it.
 */
export function fillRelativeWildcards(keyframes: UnresolvedValueKeyframe[]) {
    for (let i = 1; i < keyframes.length; i++) {
        const origin = keyframes[i - 1]
        let keyframe = keyframes[i] ?? origin

        if (isRelativeKeyframe(keyframe)) {
            const offset = keyframe[0] + keyframe.slice(2)
            const value = parseFloat(origin as string) + parseFloat(offset)
            const unit = unitOf(offset) || unitOf(origin)
            keyframe = unit ? value + unit : value
        }

        keyframes[i] = keyframe
    }
}
