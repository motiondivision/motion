import type { Bounds, ConstraintsType } from "."

/**
 * The constraints an element's gestures share. Setting constraints on
 * `drag()` or `pinch()` (or calling `constrain()`) replaces them, so the
 * last one set applies to both gestures.
 */
export interface ElementConstraints {
    /**
     * What set them: a gesture recognises its own.
     */
    owner: unknown
    target: unknown
    type: ConstraintsType
    bounds?: Bounds
}

export const elementConstraints = new WeakMap<Element, ElementConstraints>()

/**
 * Set an element's constraints, replacing those set before.
 */
export const setElementConstraints = (
    element: Element,
    owner: unknown,
    target: unknown,
    type: ConstraintsType,
    bounds?: Bounds
) => elementConstraints.set(element, { owner, target, type, bounds })

/**
 * Remove an element's constraints, if `owner` set them.
 */
export const removeElementConstraints = (element: Element, owner: unknown) =>
    elementConstraints.get(element)?.owner === owner &&
    elementConstraints.delete(element)

/**
 * Set by the constraints module when an app includes it (through
 * `constrain()` or `pinch()`), so a drag only shares its constraints, and
 * only pays for doing so, when something can use them.
 */
export const constraintsHooks: {
    sync?: (drag: any) => void
    get?: (drag: any) => Bounds | undefined
    remove?: (drag: any) => void
} = {}
