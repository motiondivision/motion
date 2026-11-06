import type { IProjectionNode } from "../projection/node/types"

/**
 * Mounted projection nodes for planes drawn outside the DOM, like meshes in
 * a WebGL scene. They take part in every animateLayout() commit, alongside
 * the elements in its scope.
 */
export const layoutPlanes = /* @__PURE__ */ new Set<IProjectionNode>()

/**
 * Removed elements kept in the DOM while they crossfade out, with where
 * they were. During an update they're taken out of the DOM, so the update
 * sees them as removed, and only come back if it puts them back.
 */
export const exitingElements = /* @__PURE__ */ new Map<
    Element,
    { parent: Element; next: ChildNode | null }
>()
