import type { MotionNode } from "../node/MotionNode"

/**
 * The node that owns each DOM element: the VisualElement of a motion
 * component, or the node `animate()`, `styleEffect()` and gestures made
 * for it. There's one per element, so they all share its values.
 */
export const nodeStore = new WeakMap<any, MotionNode>()

/**
 * The store under its original name. It holds any MotionNode: check
 * for what you need on it rather than assuming a VisualElement.
 */
export const visualElementStore = nodeStore as WeakMap<any, any>
