import { noop } from "motion-utils"
import { resolveVisualElement } from "../../layout/visual-element"
import type { IProjectionNode } from "../../projection/node/types"
import { visualElementStore } from "../../render/store"
import { createDragMeasureNode } from "./measure-node"

type CreateNode = (element: HTMLElement) => [IProjectionNode, VoidFunction]

/**
 * animateLayout() registers a function here that creates nodes in the
 * layout projection tree. When it's in the bundle, drag() uses those, so
 * the two work together (e.g. a drag follows a layout change mid-gesture).
 * Otherwise drag() makes do with a node that only measures. Bundles that
 * don't tree-shake (dev pre-bundling, CDN builds) always register it, and
 * a drag() started before animateLayout() is lazy loaded keeps its node.
 */
export const layoutProjection: { create?: CreateNode } = {}

const createMeasureNode: CreateNode = (element) => {
    const visualElement = resolveVisualElement(element)
    const result = createDragMeasureNode(visualElement, element)
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
