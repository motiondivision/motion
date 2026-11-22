import { BasicDocumentProjectionNode } from "./BasicDocumentProjectionNode"
import { createBasicProjectionNode } from "./create-basic-projection-node"
import { rootProjectionNode } from "./root"
import type { IProjectionNode, ProjectionNodeConfig } from "./types"

export function createHTMLProjectionConfig(
    DocumentNode: new (latestValues?: any) => IProjectionNode<Window>
): ProjectionNodeConfig<HTMLElement> {
    return {
        measureScroll: (instance) => ({
            x: instance.scrollLeft,
            y: instance.scrollTop,
        }),
        defaultParent: () => {
            if (!rootProjectionNode.current) {
                const documentNode = new DocumentNode({})
                documentNode.mount(window)
                documentNode.setOptions({ layoutScroll: true })
                rootProjectionNode.current = documentNode
            }
            return rootProjectionNode.current
        },
        resetTransform: (instance, value) => {
            instance.style.transform = value !== undefined ? value : "none"
        },
        checkIsScrollRoot: (instance) =>
            window.getComputedStyle(instance).position === "fixed",
    }
}

export const BasicHTMLProjectionNode =
    /* @__PURE__ */ createBasicProjectionNode<HTMLElement>(
        /* @__PURE__ */ createHTMLProjectionConfig(BasicDocumentProjectionNode)
    )
