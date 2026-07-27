import { createProjectionNode } from "./create-projection-node"
import { DocumentProjectionNode } from "./DocumentProjectionNode"
import { IProjectionNode } from "./types"

export const rootProjectionNode: { current: IProjectionNode | undefined } = {
    current: undefined,
}

export const HTMLProjectionNode = createProjectionNode<HTMLElement>({
    measureScroll: (instance) => ({
        x: instance.scrollLeft,
        y: instance.scrollTop,
    }),
    defaultParent: () => {
        if (!rootProjectionNode.current) {
            const documentNode = new DocumentProjectionNode({})
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
        Boolean(window.getComputedStyle(instance).position === "fixed"),
})
