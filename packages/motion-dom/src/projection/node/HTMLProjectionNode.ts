import { createProjectionNode } from "./create-projection-node"
import { DocumentProjectionNode } from "./DocumentProjectionNode"
import { rootProjectionNode } from "./root"

/**
 * The root every node in the document shares, so elements anywhere in it
 * (and nodes outside it, like planes in a canvas) share layoutIds.
 */
export const documentRoot = () => {
    if (!rootProjectionNode.current) {
        const documentNode = new DocumentProjectionNode({})
        documentNode.mount(window)
        documentNode.setOptions({ layoutScroll: true })
        rootProjectionNode.current = documentNode
    }
    return rootProjectionNode.current
}

export const HTMLProjectionNode =
    /* @__PURE__ */ createProjectionNode<HTMLElement>({
        measureScroll: (instance) => ({
            x: instance.scrollLeft,
            y: instance.scrollTop,
        }),
        defaultParent: documentRoot,
        resetTransform: (instance, value) => {
            instance.style.transform = value !== undefined ? value : "none"
        },
        checkIsScrollRoot: (instance) =>
            window.getComputedStyle(instance).position === "fixed",
    })
