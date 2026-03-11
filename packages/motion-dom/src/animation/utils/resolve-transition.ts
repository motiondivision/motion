/**
 * If `transition` has `inherit: true`, shallow-merge it with
 * `parentTransition` (child keys win) and strip the `inherit` key.
 * Otherwise return `transition` unchanged.
 */
export function resolveTransition(
    transition: any,
    parentTransition?: any
) {
    if (transition?.inherit && parentTransition) {
        const { inherit: _, ...rest } = transition
        return { ...parentTransition, ...rest }
    }

    return transition
}
