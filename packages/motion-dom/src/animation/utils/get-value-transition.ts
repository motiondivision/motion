export function getValueTransition(transition: any, key: string) {
    return (
        transition?.[key as keyof typeof transition] ??
        transition?.["default"] ??
        transition
    )
}
