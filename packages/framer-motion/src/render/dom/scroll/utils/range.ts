/**
 * Resolve a user-provided `rangeStart`/`rangeEnd` into a 0–1 scroll progress
 * fraction, used to drive the JS observe fallback's active window.
 *
 * Accepts a number (already a 0–1 fraction), a percentage string (`"20%"`) or
 * a bare numeric string (`"0.2"`). Anything unparseable (e.g. a named WAAPI
 * range like `"cover 50%"`, which only applies to native timelines) falls back
 * to the provided default.
 */
export function resolveRangeFraction(
    value: string | number | undefined,
    fallback: number
): number {
    if (value === undefined) return fallback
    if (typeof value === "number") return value

    const parsed = parseFloat(value)
    if (Number.isNaN(parsed)) return fallback

    return value.trim().endsWith("%") ? parsed / 100 : parsed
}

/**
 * Resolve a user-provided `rangeStart`/`rangeEnd` into a WAAPI-acceptable
 * string, converting a 0–1 fraction into a percentage.
 */
export function resolveRangeString(
    value: string | number | undefined
): string | undefined {
    if (value === undefined) return undefined
    return typeof value === "number" ? `${value * 100}%` : value
}
