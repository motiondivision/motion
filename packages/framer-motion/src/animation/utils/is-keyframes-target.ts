import type {
    UnresolvedValueKeyframe,
    ValueKeyframesDefinition,
} from "motion-dom"

export const isKeyframesTarget = (
    v: ValueKeyframesDefinition
): v is UnresolvedValueKeyframe[] => {
    return Array.isArray(v)
}
