import { addDomEvent } from "../../events/add-dom-event"
import { measureDocumentScroll } from "../utils/measure"
import { createProjectionNode } from "./create-projection-node"

export const DocumentProjectionNode =
    /* @__PURE__ */ createProjectionNode<Window>({
        attachResizeListener: (
            ref: Window | Element,
            notify: VoidFunction
        ): VoidFunction => addDomEvent(ref, "resize", notify),
        measureScroll: measureDocumentScroll,
        checkIsScrollRoot: () => true,
    })
