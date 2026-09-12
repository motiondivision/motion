import { cornerRadiusProps } from "../../../utils/border-radius"

/**
 * Numeric CSS properties that can use WAAPI without compositor support.
 * Layout participants must keep these values available to projection.
 */
export const nativeNumericValues = new Set([
    "width",
    "height",
    "borderRadius",
    ...cornerRadiusProps,
])
