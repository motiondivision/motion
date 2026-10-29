export function isRefObject<E = any>(ref: any): ref is { current: E } {
    return (
        ref &&
        typeof ref === "object" &&
        Object.prototype.hasOwnProperty.call(ref, "current")
    )
}
