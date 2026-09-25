import { ScrollRange } from "../types"

/**
 * Resolve a `rangeStart`/`rangeEnd` into a `0`–`1` fraction for the JS
 * observe path. Anything unparseable resolves to `fallback`.
 */
export function resolveRangeFraction(
    value: ScrollRange | undefined,
    fallback: number
): number {
    const fraction = typeof value === "string" ? parseFloat(value) / 100 : value
    return fraction === undefined || isNaN(fraction) ? fallback : fraction
}

/**
 * Resolve a `rangeStart`/`rangeEnd` into a WAAPI range string.
 */
export const resolveRangeString = (value: ScrollRange | undefined) =>
    typeof value === "number" ? value * 100 + "%" : value
