import { createProjectionNode } from "./create-projection-node"
import { DocumentProjectionNode } from "./DocumentProjectionNode"
import { rootProjectionNode } from "./root"

export const HTMLProjectionNode =
    /* @__PURE__ */ createProjectionNode<HTMLElement>({
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
            window.getComputedStyle(instance).position === "fixed",
    })
