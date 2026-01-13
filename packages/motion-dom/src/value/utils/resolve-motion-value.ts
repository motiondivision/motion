import type { AnyResolvedKeyframe } from "../../animation/types"
import { isMotionValue } from "./is-motion-value"
import type { MotionValue } from "../index"

/**
 * If the provided value is a MotionValue, this returns the actual value, otherwise just the value itself
 */
export function resolveMotionValue(
    value?: AnyResolvedKeyframe | MotionValue
): AnyResolvedKeyframe {
    return isMotionValue(value) ? value.get() : value
}
