import { AnimationPlaybackOptions } from "../types"

export function getFinalKeyframe<T>(
    keyframes: T[],
    { repeat, repeatType = "loop" }: AnimationPlaybackOptions,
    finalKeyframe?: T,
    speed: number = 1
): T {
    /**
     * The first and last keyframes that aren't null, and how many there
     * are. Found in one pass rather than filtering into a new array, as
     * this runs for every value of every animation.
     */
    let first: T | undefined
    let last: T | undefined
    let numResolved = 0
    for (let i = 0; i < keyframes.length; i++) {
        const keyframe = keyframes[i]
        if (keyframe !== null) {
            if (!numResolved++) first = keyframe
            last = keyframe
        }
    }

    const useFirstKeyframe =
        speed < 0 || (repeat && repeatType !== "loop" && repeat % 2 === 1)
    const index = useFirstKeyframe ? 0 : numResolved - 1

    return !index || finalKeyframe === undefined
        ? ((index ? last : first) as T)
        : finalKeyframe
}
