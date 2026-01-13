import { transformProps } from "./keys-transform"
import type { MotionNodeOptions } from "../../node/types"
import {
    scaleCorrectors,
    addScaleCorrector,
} from "../../projection/styles/scale-correction"

export { scaleCorrectors, addScaleCorrector }

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
