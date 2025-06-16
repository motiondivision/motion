export type CSSVariableName = `--${string}`

export type CSSVariableToken = `var(${CSSVariableName})`

const checkStringStartsWith =
    <T extends string>(token: string) =>
    (key?: string | number | null): key is T =>
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
