import { UnresolvedValueKeyframe, ValueKeyframe } from "../../types"
import { pxValues } from "../../waapi/utils/px-values"

export function applyPxDefaults(
    keyframes: ValueKeyframe[] | UnresolvedValueKeyframe[],
    name: string
) {
    for (let i = 0; i < keyframes.length; i++) {
        if (typeof keyframes[i] === "number" && pxValues.has(name)) {
            keyframes[i] = keyframes[i] + "px"
        }
    }
}
