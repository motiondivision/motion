import { resolveTransition } from "./resolve-transition"

export function getValueTransition(transition: any, key: string) {
    const valueTransition =
        transition?.[key as keyof typeof transition] ??
        transition?.["default"] ??
        transition

    if (valueTransition !== transition) {
        return resolveTransition(valueTransition, transition)
    }

    return valueTransition
}
