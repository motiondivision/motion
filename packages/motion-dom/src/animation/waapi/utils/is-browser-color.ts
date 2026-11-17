const browserColorFunctions =
    /^(?:oklch|oklab|lab|lch|color|color-mix|light-dark)\(/

export const hasBrowserOnlyColors = (keyframes: any[]): boolean =>
    keyframes.some(
        (keyframe) =>
            typeof keyframe === "string" && browserColorFunctions.test(keyframe)
    )
