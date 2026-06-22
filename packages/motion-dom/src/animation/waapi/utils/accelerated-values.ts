/**
 * A list of values that can be hardware-accelerated.
 */
export const acceleratedValues = new Set<string>([
    "opacity",
    "clipPath",
    "filter",
    "transform",
    // Color animations are paint-bound, so this is a main-thread offload (not
    // free compositor rendering). Names are camelCase Motion value names.
    "backgroundColor",
    "color",
    // Remaining colors (borderColor family, fill/stroke) are left out for now:
    // they have extra constraints and SVG is excluded by the HTMLElement check
    // in supports/waapi.ts. They still accelerate via the browser-only-color
    // path when keyframes use formats the JS path can't parse (oklch/lab/etc.).
])
