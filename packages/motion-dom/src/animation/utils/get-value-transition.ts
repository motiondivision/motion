export function getValueTransition(transition: any, key: string) {
    const valueTransition =
        transition?.[key as keyof typeof transition] ??
        transition?.["default"] ??
        transition

    if (valueTransition?.inherit && valueTransition !== transition) {
        const { inherit: _, ...rest } = valueTransition
        return { ...transition, ...rest }
    }

    return valueTransition
}
