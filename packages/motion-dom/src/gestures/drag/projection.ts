import { Box, noop, SubscriptionManager } from "motion-utils"
import { resolveVisualElement } from "../../layout/visual-element"
import { roundBox } from "../../projection/geometry/round"
import type { IProjectionNode } from "../../projection/node/types"
import {
    measureDocumentScroll,
    measurePageBox,
} from "../../projection/utils/measure"
import { visualElementStore } from "../../render/store"

type CreateNode = (element: HTMLElement) => [IProjectionNode, VoidFunction]

/**
 * animateLayout() registers a function here that creates nodes in the
 * layout projection tree. When it's in the bundle, drag() uses those, so
 * the two work together (e.g. a drag follows a layout change mid-gesture).
 * Otherwise drag() makes do with a node that only measures.
 */
export const layoutProjection: { create?: CreateNode } = {}

/**
 * The document root of measurement-only nodes. Like the projection tree's
 * root, it keeps its scroll until drag controls clear it to re-measure.
 */
const root: any = {
    updateScroll: () => {
        root.scroll ||= { offset: measureDocumentScroll() }
    },
}

/**
 * The part of a projection node that drag controls use: measuring the
 * element's page box, for its layout and constraints. It never projects
 * or joins a layout update.
 */
const createMeasureNode: CreateNode = (element) => {
    const visualElement = resolveVisualElement(element)
    const measureListeners = new SubscriptionManager()

    const node: any = {
        instance: element,
        root,
        path: [root],
        setOptions: noop,
        /**
         * Truthy like the full node's method, which HTMLVisualElement reads
         * (rather than calls) to default transform values.
         */
        isProjecting: noop,
        applyProjectionStyles: noop,
        removeElementScroll: (box: Box) => box,
        updateLayout: () => {
            const layoutBox = measurePageBox(
                element,
                root,
                visualElement.getTransformPagePoint()
            )
            roundBox(layoutBox)
            node.layout = { layoutBox }
            measureListeners.notify()
        },
        addEventListener: (name: string, handler: VoidFunction) =>
            name === "measure" ? measureListeners.add(handler) : noop,
        unmount: () => (node.instance = undefined),
    }

    visualElement.projection = node
    visualElement.current || visualElement.mount(element)

    return [node, node.unmount]
}

/**
 * Get a projection node for drag() to measure an element with, and a
 * function that releases it. Reuses a node a `motion` component or
 * animateLayout() owns.
 */
export const acquireDragNode: CreateNode = (element) => {
    const owned = visualElementStore.get(element)?.projection

    /**
     * A VisualElement can outlive a node we released (e.g. a stopped
     * drag()), so only reuse a node that's still mounted.
     */
    return owned?.instance
        ? [owned, noop as VoidFunction]
        : (layoutProjection.create || createMeasureNode)(element)
}
