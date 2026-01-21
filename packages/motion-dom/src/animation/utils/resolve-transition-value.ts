import { isCSSVariableToken } from "./is-css-variable"
import { getVariableValue, parseCSSVariable } from "./css-variables-conversion"

/**
 * Regex to parse CSS time values like "2s", "500ms", "0.5s", ".3s"
 */
const cssTimeRegex = /^(-?[\d.]+)(s|ms)?$/

/**
 * Parse a CSS time value string (e.g., "2s", "500ms", "0.3") into milliseconds.
 * Plain numbers are interpreted as seconds (matching Motion's API convention).
 *
 * @param value - The time value string to parse
 * @returns The time in milliseconds, or undefined if parsing fails
 */
export function parseTimeValue(value: string): number | undefined {
    const trimmed = value.trim()
    const match = cssTimeRegex.exec(trimmed)

    if (!match) return undefined

    const [, numStr, unit] = match
    const num = parseFloat(numStr)

    if (isNaN(num)) return undefined

    // If unit is "ms", return as-is
    // If unit is "s" or no unit (plain number), convert to milliseconds
    // Plain numbers are treated as seconds to match Motion's transition API
    if (unit === "ms") {
        return num
    }

    // Seconds (explicit "s" or no unit) -> convert to milliseconds
    return num * 1000
}

/**
 * Resolve a transition timing value that may be:
 * - A number (in seconds, converted to milliseconds)
 * - A CSS variable (e.g., "var(--duration)")
 * - A time string (e.g., "2s", "500ms")
 * - undefined (returns default value)
 *
 * @param value - The value to resolve
 * @param element - The DOM element for CSS variable resolution
 * @param defaultValue - Default value in milliseconds if resolution fails
 * @returns The resolved time in milliseconds
 */
export function resolveTransitionValue(
    value: number | string | undefined,
    element: Element,
    defaultValue: number
): number {
    if (value === undefined) return defaultValue
    // Numbers are in seconds (Motion's API convention), convert to ms
    if (typeof value === "number") return value * 1000

    // Handle CSS variable
    if (isCSSVariableToken(value)) {
        const resolved = getVariableValue(value, element)

        if (resolved !== undefined) {
            // If resolved to a number, treat as seconds and convert to ms
            if (typeof resolved === "number") {
                return resolved * 1000
            }
            // If resolved to a string, parse it
            const parsed = parseTimeValue(resolved)
            if (parsed !== undefined) return parsed
        }

        // Try to use the fallback from var(--foo, fallback)
        const [, fallback] = parseCSSVariable(value)
        if (fallback) {
            const parsedFallback = parseTimeValue(fallback)
            if (parsedFallback !== undefined) return parsedFallback
        }

        return defaultValue
    }

    // Handle direct time string
    const parsed = parseTimeValue(value)
    return parsed !== undefined ? parsed : defaultValue
}
