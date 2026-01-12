import { transformProps } from "./keys-transform"
import type { MotionNodeOptions } from "../../node/types"
import {
    scaleCorrectors,
    addScaleCorrector,
} from "../../projection/styles/scale-correction"

// Re-export for backward compatibility
export { scaleCorrectors }
export { addScaleCorrector as addScaleCorrectors }

export function isForcedMotionValue(
    key: string,
    { layout, layoutId }: MotionNodeOptions
) {
    return (
        transformProps.has(key) ||
        key.startsWith("origin") ||
        ((layout || layoutId !== undefined) &&
            (!!scaleCorrectors[key] || key === "opacity"))
    )
}
