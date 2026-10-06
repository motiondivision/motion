/**
 * The independent transform (x, scale, rotate etc) animations running on
 * each element, composed into one hardware-accelerated `transform`.
 *
 * Kept apart from the group itself so renderers and projection can tell a
 * group about outside changes without importing the animation code.
 */
export interface TransformGroupHooks {
    /**
     * A transform value may have been set by something other than one of
     * the group's animations.
     */
    check(): void

    /**
     * Hand every animation in the group back to the main thread, with
     * up-to-date values, e.g. before layout is measured.
     */
    demote(): void
}

export const transformGroups = new WeakMap<object, TransformGroupHooks>()
