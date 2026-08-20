import type { ResolvedValues } from "../../../render/types"
import { transformProps } from "../../../render/utils/keys-transform"

/**
 * A list of values that can be hardware-accelerated.
 */
export const acceleratedValues = new Set<string>([
    "opacity",
    "clipPath",
    "filter",
    "transform",
    "backgroundColor",
])

export function hasIndependentTransform(values?: ResolvedValues) {
    if (!values) return false

    for (const key in values) {
        if (transformProps.has(key)) return true
    }
    return false
}
