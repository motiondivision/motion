import { UnresolvedValueKeyframe, ValueKeyframe } from "../../types"

export function fillWildcards(
    keyframes: ValueKeyframe[] | UnresolvedValueKeyframe[]
) {
    for (let i = 1; i < keyframes.length; i++) {
        keyframes[i] ??= keyframes[i - 1]
    }
}
