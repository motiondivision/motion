import { MotionProps } from "../.."
import { scaleCorrectors } from "../../projection/styles/scale-correction"
import { transformProps } from "../../render/html/utils/keys-transform"

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
