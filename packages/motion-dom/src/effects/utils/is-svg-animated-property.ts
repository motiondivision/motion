export function isSVGTransformProperty(
    element: Element,
    name: string
): boolean {
    if (name !== "transform") return false
    const value = (element as any)[name]
    return (
        value !== null &&
        typeof value === "object" &&
        "baseVal" in value
    )
}
