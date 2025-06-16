import { AnimationPlaybackOptions } from "motion-dom"

const isNotNull = (value: unknown) => value !== null

export function getFinalKeyframe<T>(
    keyframes: T[],
    { repeat, repeatType = "loop" }: AnimationPlaybackOptions,
    finalKeyframe?: T
): T {
    const resolvedKeyframes = keyframes.filter(isNotNull)
    const index =
        repeat && repeatType !== "loop" && repeat % 2 === 1
            ? 0
            : resolvedKeyframes.length - 1

    return !index || finalKeyframe === undefined
        ? resolvedKeyframes[index]
        : finalKeyframe
}
