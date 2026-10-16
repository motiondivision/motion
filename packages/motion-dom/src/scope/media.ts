const keywords: Record<string, string> = {
    reducedMotion: "(prefers-reduced-motion: reduce)",
    motion: "(prefers-reduced-motion: no-preference)",
    dark: "(prefers-color-scheme: dark)",
    light: "(prefers-color-scheme: light)",
    hover: "(hover: hover) and (pointer: fine)",
    touch: "(pointer: coarse)",
    portrait: "(orientation: portrait)",
    landscape: "(orientation: landscape)",
}

/**
 * Turn a condition into a media query. Full media queries pass through
 * unchanged. Otherwise each space-separated token must match:
 *
 * - A width comparison: `">=800"`, `"<1200px"`, `"> 40em"`
 * - A keyword: `reducedMotion`, `motion`, `dark`, `light`, `hover`,
 *   `touch`, `portrait`, `landscape`
 *
 * Prefix a token with `!` to negate it, for instance `">=800 !touch"`.
 */
export function toMediaQuery(condition: string) {
    if (condition.includes("(")) return condition

    return condition
        .replace(/([<>!]=?)\s+/g, "$1")
        .trim()
        .split(/\s+/)
        .map((token) => {
            const isNot = token[0] === "!"
            if (isNot) token = token.slice(1)

            const width = /^([<>]=?)([\d.]+)([a-z]*)$/.exec(token)
            const query = width
                ? `(width ${width[1]} ${width[2]}${width[3] || "px"})`
                : keywords[token] || token

            return isNot ? `(not (${query}))` : query
        })
        .join(" and ")
}
