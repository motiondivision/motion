import type { UnresolvedValueKeyframe, ValueKeyframesDefinition } from "../../animation/types"

export const isKeyframesTarget = (
    v: ValueKeyframesDefinition
): v is UnresolvedValueKeyframe[] => {
    return Array.isArray(v)
}
