import { noop } from "motion-utils"
import { resolveVisualElement } from "../../layout/visual-element"
import type { IProjectionNode } from "../../projection/node/types"
import { visualElementStore } from "../../render/store"
import { createDragMeasureNode } from "./measure-node"

type CreateNode = (element: HTMLElement) => [IProjectionNode, VoidFunction]

/**
 * animateLayout() registers a function here the first time it runs, so
 * later drag() calls create their nodes in the shared layout projection
 * tree. drag() calls made before then use a node that only measures, kept
 * in `pending`. Registration upgrades each of these to a full node, so
 * dragged elements join the tree (e.g. as the parent of a layout child).
 */
export const layoutProjection: {
    create?: CreateNode
    pending: Set<any>
} = { pending: /* @__PURE__ */ new Set() }

const createMeasureNode: CreateNode = (element) => {
    const visualElement = resolveVisualElement(element)
    const result = createDragMeasureNode(
        visualElement,
        element,
        layoutProjection.pending
    )
    visualElement.current || visualElement.mount(element)
    return result
}

/**
 * Get a projection node for drag() to measure an element with, and a
 * function that releases it. Reuses a node a `motion` component or
 * animateLayout() owns.
 */
export const acquireDragNode: CreateNode = (element) => {
    const owned = visualElementStore.get(element)?.projection

    /**
     * A VisualElement can outlive its node (e.g. an unmounted `motion`
     * component's), so only reuse a node that's still mounted.
     */
    return owned?.instance
        ? [owned, noop as VoidFunction]
        : (layoutProjection.create || createMeasureNode)(element)
}
