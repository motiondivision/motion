import { Box, noop, SubscriptionManager } from "motion-utils"
import { roundBox } from "../../projection/geometry/round"
import type { IProjectionNode } from "../../projection/node/types"
import {
    measureDocumentScroll,
    measurePageBox,
} from "../../projection/utils/measure"
import type { VisualElement } from "../../render/VisualElement"

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
 * or joins a layout update until a full node replaces it, through
 * `upgrade` (when domLayout or domMax loads after domDrag, or when
 * animateLayout() first runs after drag()).
 *
 * Nodes made by drag() pass `pending`, the set animateLayout() upgrades.
 */
export function createDragMeasureNode(
    visualElement: VisualElement<HTMLElement>,
    element?: HTMLElement,
    pending?: Set<IProjectionNode>
): [IProjectionNode, VoidFunction] {
    const listeners = {
        measure: new SubscriptionManager(),
        didUpdate: new SubscriptionManager(),
    }
    let upgraded: IProjectionNode | undefined
    let stopUpgraded: VoidFunction[] = []

    const node: any = {
        instance: element,
        root,
        path: [root],
        options: {},
        isMeasureOnly: true,
        setOptions: (options: Record<string, any>) => {
            node.options = { ...node.options, ...options }
            upgraded?.setOptions(options)
        },
        /**
         * Truthy like the full node's method, which HTMLVisualElement reads
         * (rather than calls) to default transform values.
         */
        isProjecting: noop,
        applyProjectionStyles: noop,
        prepareFlush: noop,
        removeElementScroll: (box: Box) => box,
        mount: (el: HTMLElement) => {
            node.instance = el
        },
        updateLayout: () => {
            const { instance } = node
            if (!instance) return
            /**
             * Measure without the element's transform, like the full node,
             * as drag sets x/y. Reading and restoring it in the same task
             * doesn't paint.
             */
            const { style } = instance
            const { transform } = style
            const { transformTemplate } = visualElement.getProps()
            style.transform = transformTemplate
                ? transformTemplate({}, "")
                : "none"
            const layoutBox = measurePageBox(
                instance,
                root,
                visualElement.getTransformPagePoint()
            )
            style.transform = transform
            roundBox(layoutBox)
            node.layout = { layoutBox }
            listeners.measure.notify()
        },
        addEventListener: (name: "measure" | "didUpdate", handler: any) =>
            upgraded
                ? upgraded.addEventListener(name, handler)
                : listeners[name]?.add(handler) || noop,
        /**
         * Hand over to a full node, and forward its events to listeners
         * added to this one. `release` is for a node drag() then owns, and
         * runs when this node is released.
         */
        upgrade: ([next, release]: [IProjectionNode, VoidFunction?]) => {
            pending?.delete(node)
            upgraded = next
            next.setOptions(node.options)
            if (node.isAnimationBlocked) next.isAnimationBlocked = true
            stopUpgraded = (["measure", "didUpdate"] as const).map((name) =>
                next.addEventListener(name, (...args: any[]) =>
                    (listeners[name].notify as any)(...args)
                )
            )
            release && stopUpgraded.push(release)
        },
        /**
         * Keep the VisualElement's reference, so a remount (e.g. in
         * StrictMode) mounts this node again.
         */
        unmount: () => {
            node.instance = undefined
        },
    }

    /**
     * Detach from the VisualElement too, so it doesn't later remount (or a
     * `motion` component's layout feature adopt) a node that can't do
     * either.
     */
    const release = () => {
        pending?.delete(node)
        stopUpgraded.forEach((stop) => stop())
        node.unmount()
        if (visualElement.projection === node) {
            visualElement.projection = undefined
        }
    }

    visualElement.projection = node
    pending?.add(node)

    return [node, release]
}
