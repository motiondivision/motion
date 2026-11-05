import type { IProjectionNode } from "../projection/node/types"

/**
 * Mounted projection nodes for planes drawn outside the DOM, like meshes in
 * a WebGL scene. They take part in every animateLayout() commit, alongside
 * the elements in its scope.
 */
export const layoutPlanes = /* @__PURE__ */ new Set<IProjectionNode>()
