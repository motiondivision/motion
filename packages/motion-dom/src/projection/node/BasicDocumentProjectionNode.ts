import { addDomEvent } from "../../events/add-dom-event"
import { measureDocumentScroll } from "../utils/measure"
import { createBasicProjectionNode } from "./create-basic-projection-node"
import type { ProjectionNodeConfig } from "./types"

export const documentProjectionNodeConfig: ProjectionNodeConfig<Window> = {
    attachResizeListener: (
        ref: Window | Element,
        notify: VoidFunction
    ): VoidFunction => addDomEvent(ref, "resize", notify),
    measureScroll: measureDocumentScroll,
    checkIsScrollRoot: () => true,
}

export const BasicDocumentProjectionNode =
    /* @__PURE__ */ createBasicProjectionNode<Window>(
        documentProjectionNodeConfig
    )
