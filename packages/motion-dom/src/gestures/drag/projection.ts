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
 * or joins a layout update until upgraded by animateLayout().
 */
const createMeasureNode: CreateNode = (element) => {
    const visualElement = resolveVisualElement(element)
    const listeners = {
        measure: new SubscriptionManager(),
        didUpdate: new SubscriptionManager(),
    }
    let upgraded: IProjectionNode | undefined
    let stopUpgraded: VoidFunction[] = []
    let options: Record<string, any> | undefined

    const node: any = {
        instance: element,
        root,
        path: [root],
        setOptions: (nextOptions: Record<string, any>) => {
            options = options ? { ...options, ...nextOptions } : nextOptions
            upgraded?.setOptions(nextOptions)
        },
        /**
         * Truthy like the full node's method, which HTMLVisualElement reads
         * (rather than calls) to default transform values.
         */
        isProjecting: noop,
        applyProjectionStyles: noop,
        prepareFlush: noop,
        removeElementScroll: (box: Box) => box,
        updateLayout: () => {
            const layoutBox = measurePageBox(
                element,
                root,
                visualElement.getTransformPagePoint()
            )
            roundBox(layoutBox)
            node.layout = { layoutBox }
            listeners.measure.notify()
        },
        addEventListener: (name: "measure" | "didUpdate", handler: any) =>
            upgraded
                ? upgraded.addEventListener(name, handler)
                : listeners[name]?.add(handler) || noop,
        /**
         * Hand over to a full node. drag() then owns it, and releases it
         * when it stops, like a node it created after registration.
         */
        upgrade: ([nextNode, release]: [IProjectionNode, VoidFunction]) => {
            layoutProjection.pending.delete(node)
            upgraded = nextNode
            if (options) nextNode.setOptions(options)
            if (node.isAnimationBlocked) nextNode.isAnimationBlocked = true
            stopUpgraded = (["measure", "didUpdate"] as const).map((name) =>
                nextNode.addEventListener(name, (...args: any[]) =>
                    (listeners[name].notify as any)(...args)
                )
            )
            stopUpgraded.push(release)
        },
        /**
         * Detach from the VisualElement too, so it doesn't later remount
         * (or a `motion` component's layout feature adopt) a node that
         * can't do either.
         */
        unmount: () => {
            layoutProjection.pending.delete(node)
            stopUpgraded.forEach((stop) => stop())
            node.instance = undefined
            if (visualElement.projection === node) {
                visualElement.projection = undefined
            }
        },
    }

    visualElement.projection = node
    layoutProjection.pending.add(node)
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
     * A VisualElement can outlive its node (e.g. an unmounted `motion`
     * component's), so only reuse a node that's still mounted.
     */
    return owned?.instance
        ? [owned, noop as VoidFunction]
        : (layoutProjection.create || createMeasureNode)(element)
}
