import { invariant, isNumericalString } from "motion-utils"
import { AnyResolvedKeyframe } from "../types"
import { CSSVariableToken, isCSSVariableToken } from "./is-css-variable"

/**
 * Parse Framer's special CSS variable format into a CSS token and a fallback.
 *
 * ```
 * `var(--foo, #fff)` => [`--foo`, '#fff']
 * ```
 *
 * @param current
 */

const splitCSSVariableRegex =
    // eslint-disable-next-line redos-detector/no-unsafe-regex -- false positive, as it can match a lot of words
    /^var\(--(?:([\w-]+)|([\w-]+), ?([a-zA-Z\d ()%#.,-]+))\)/u
export function parseCSSVariable(current: string) {
    const match = splitCSSVariableRegex.exec(current)
    if (!match) return [,]

    const [, token1, token2, fallback] = match
    return [`--${token1 ?? token2}`, fallback]
}

const maxDepth = 4
export function getVariableValue(
    current: CSSVariableToken,
    element: Element,
    depth = 1
): AnyResolvedKeyframe | undefined {
    invariant(
        depth <= maxDepth,
        `Max CSS variable fallback depth detected in property "${current}". This may indicate a circular fallback dependency.`,
        "max-css-var-depth"
    )

    const [token, fallback] = parseCSSVariable(current)

    // No CSS variable detected
    if (!token) return

    // Attempt to read this CSS variable off the element
    const resolved = window.getComputedStyle(element).getPropertyValue(token)

    if (resolved) {
        const trimmed = resolved.trim()
        return isNumericalString(trimmed) ? parseFloat(trimmed) : trimmed
    }

    return isCSSVariableToken(fallback)
        ? getVariableValue(fallback, element, depth + 1)
        : fallback
}
