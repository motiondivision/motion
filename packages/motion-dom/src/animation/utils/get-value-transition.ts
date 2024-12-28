export function getValueTransition(transition: any, key: string) {
    return transition
        ? transition[key as keyof typeof transition] ||
              (transition as any)["default"] ||
              transition
        : undefined
}
