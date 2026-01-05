import { AnyResolvedKeyframe } from "../types"

export type CSSVariableName = `--${string}`

export type CSSVariableToken = `var(${CSSVariableName})`

const checkStringStartsWith =
    <T extends string>(token: string) =>
    (key?: AnyResolvedKeyframe | null): key is T =>
        typeof key === "string" && key.startsWith(token)

export const isCSSVariableName =
    /*@__PURE__*/ checkStringStartsWith<CSSVariableName>("--")

const startsAsVariableToken =
    /*@__PURE__*/ checkStringStartsWith<CSSVariableToken>("var(--")
export const isCSSVariableToken = (
    value?: string
): value is CSSVariableToken => {
    const startsWithToken = startsAsVariableToken(value)

    if (!startsWithToken) return false

    // Ensure any comments are stripped from the value as this can harm performance of the regex.
    return singleCssVariableRegex.test(value.split("/*")[0].trim())
}

const singleCssVariableRegex =
    /var\(--(?:[\w-]+\s*|[\w-]+\s*,(?:\s*[^)(\s]|\s*\((?:[^)(]|\([^)(]*\))*\))+\s*)\)$/iu

/**
 * Check if a value contains a CSS variable anywhere (e.g. inside calc()).
 * Unlike isCSSVariableToken which checks if the value IS a var() token,
 * this checks if the value CONTAINS var() somewhere in the string.
 */
export function containsCSSVariable(
    value?: AnyResolvedKeyframe | null
): boolean {
    return typeof value === "string" && value.includes("var(--")
}
