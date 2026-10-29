import type { ValueAnimationOptions } from "../../types"

/**
 * Whether an animation needs its mixer, which WAAPI can't call. Numbers
 * blend as usual, and an animation whose mixer declines every pair runs
 * as it would without one.
 */
export const needsMixer = ({ mixer, keyframes }: ValueAnimationOptions<any>) =>
    mixer &&
    typeof keyframes[0] !== "number" &&
    keyframes.some((keyframe, i) => i && mixer(keyframes[i - 1], keyframe))
