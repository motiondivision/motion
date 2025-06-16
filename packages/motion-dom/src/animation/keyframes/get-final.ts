import { AnimationPlaybackOptions } from "../types"

const isNotNull = (value: unknown) => value !== null

export function getFinalKeyframe<T>(
    keyframes: T[],
    { repeat, repeatType = "loop" }: AnimationPlaybackOptions,
    finalKeyframe?: T,
    speed: number = 1
): T {
    const resolvedKeyframes = keyframes.filter(isNotNull)
    const useFirstKeyframe =
        speed < 0 || (repeat && repeatType !== "loop" && repeat % 2 === 1)
    const index = useFirstKeyframe ? 0 : resolvedKeyframes.length - 1

    return !index || finalKeyframe === undefined
        ? resolvedKeyframes[index]
        : finalKeyframe
}
