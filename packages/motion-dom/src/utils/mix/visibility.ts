export const invisibleValues = new Set(["none", "hidden"])

/**
 * Returns a function that, when provided a progress value between 0 and 1,
 * will return the "none" or "hidden" string only when the progress is that of
 * the origin or target.
 */
export function mixVisibility(origin: string, target: string) {
    if (invisibleValues.has(origin)) {
        return (p: number) => (p <= 0 ? origin : target)
    } else {
        return (p: number) => (p >= 1 ? target : origin)
    }
}
