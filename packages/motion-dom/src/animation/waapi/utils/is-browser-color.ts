const browserColorFunctions =
    /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/i

export function hasBrowserOnlyColors(keyframes: any[]): boolean {
    for (let i = 0; i < keyframes.length; i++) {
        if (
            typeof keyframes[i] === "string" &&
            browserColorFunctions.test(keyframes[i])
        ) {
            return true
        }
    }
    return false
}
