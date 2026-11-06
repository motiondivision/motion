import { AnimationPlaybackOptions } from "../types"

export function getFinalKeyframe<T>(
    keyframes: T[],
    { repeat, repeatType = "loop" }: AnimationPlaybackOptions,
    finalKeyframe?: T,
    speed: number = 1
): T {
    /**
     * The first and last keyframes that aren't null, found without
     * making a filtered copy, as this runs every time a value is sampled
     * past its end.
     */
    let first: T | undefined
    let last: T | undefined
    let count = 0
    for (const keyframe of keyframes) {
        if (keyframe !== null) {
            count++ || (first = keyframe)
            last = keyframe
        }
    }

    return speed < 0 || (repeat && repeatType !== "loop" && repeat % 2 === 1)
        ? first!
        : count > 1 && finalKeyframe !== undefined
        ? finalKeyframe
        : last!
}
