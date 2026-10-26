/**
 * A list of values that can be hardware-accelerated.
 *
 * Colors aren't included: WAAPI mixes them in sRGB, but JS animations
 * (and the sampler that estimates a WAAPI value on interrupt) mix them
 * in linear color space, so interrupting one would visibly jump.
 */
export const acceleratedValues = new Set<string>([
    "opacity",
    "clipPath",
    "filter",
    "transform",
])
