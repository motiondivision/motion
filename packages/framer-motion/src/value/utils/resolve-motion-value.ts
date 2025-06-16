import { isMotionValue, MotionValue } from "motion-dom"

/**
 * If the provided value is a MotionValue, this returns the actual value, otherwise just the value itself
 *
 * TODO: Remove and move to library
 */
export function resolveMotionValue(
    value?: string | number | MotionValue
): string | number {
    return isMotionValue(value) ? value.get() : value
}
