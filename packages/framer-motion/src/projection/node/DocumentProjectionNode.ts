import { createProjectionNode } from "./create-projection-node"
import { addResizeEvent } from "../../events/add-resize-event"

export const DocumentProjectionNode = createProjectionNode<Window>({
    attachResizeListener: (
        ref: Window | Element,
        notify: VoidFunction
    ): VoidFunction => addResizeEvent(ref, notify),
    measureScroll: () => ({
        x: document.documentElement.scrollLeft || document.body.scrollLeft,
        y: document.documentElement.scrollTop || document.body.scrollTop,
    }),
    checkIsScrollRoot: () => true,
})
