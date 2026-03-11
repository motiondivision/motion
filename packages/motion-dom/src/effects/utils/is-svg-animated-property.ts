export function isSVGAnimatedProperty(element: Element, name: string): boolean {
    const value = (element as any)[name]

    return (
        value !== null &&
        typeof value === "object" &&
        "baseVal" in value
    )
}
