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
 * or joins a layout update.
 */
export function createDragMeasureNode(
    visualElement: VisualElement<HTMLElement>,
    element?: HTMLElement
): [IProjectionNode, VoidFunction] {
    const measureListeners = new SubscriptionManager()
    let upgraded: IProjectionNode | undefined
    const activeListeners = new Set<{
        name: string
        handler: VoidFunction
        remove: VoidFunction
    }>()

    const node: any = {
        instance: element,
        root,
        path: [root],
        options: {},
        isMeasureOnly: true,
        setOptions: noop,
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
            if (!node.instance) return
            const layoutBox = measurePageBox(
                node.instance,
                root,
                visualElement.getTransformPagePoint()
            )
            roundBox(layoutBox)
            node.layout = { layoutBox }
            measureListeners.notify()
        },
        addEventListener: (name: string, handler: VoidFunction) => {
            if (upgraded) {
                return upgraded.addEventListener(name as any, handler as any)
            }
            const entry = {
                name,
                handler,
                remove:
                    name === "measure"
                        ? measureListeners.add(handler)
                        : (noop as VoidFunction),
            }
            activeListeners.add(entry)
            return () => {
                entry.remove()
                activeListeners.delete(entry)
            }
        },
        /**
         * If a full layout projection node replaces this measurement-only node
         * (e.g. domLayout or domMax loads after domDrag), transfer any active
         * drag listeners onto the new node so layout compensation works.
         */
        upgrade: (next: IProjectionNode) => {
            upgraded = next
            node.instance = undefined
            activeListeners.forEach((entry) => {
                entry.remove()
                entry.remove = next.addEventListener(
                    entry.name as any,
                    entry.handler as any
                )
            })
        },
        unmount: () => {
            node.instance = undefined
        },
    }

    const release = () => {
        node.unmount()
        if (visualElement.projection === node) {
            visualElement.projection = undefined
        }
    }

    visualElement.projection = node

    return [node, release]
}
