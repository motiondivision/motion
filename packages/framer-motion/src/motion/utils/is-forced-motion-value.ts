import { scaleCorrectors, transformProps } from "motion-dom"
import { MotionProps } from "../.."

export function isForcedMotionValue(
    key: string,
    { layout, layoutId }: MotionProps
) {
    return (
        transformProps.has(key) ||
        key.startsWith("origin") ||
        ((layout || layoutId !== undefined) &&
            (!!scaleCorrectors[key] || key === "opacity"))
    )
}
