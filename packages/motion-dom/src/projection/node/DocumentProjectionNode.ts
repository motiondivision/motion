import { documentProjectionNodeConfig } from "./BasicDocumentProjectionNode"
import { createProjectionNode } from "./create-projection-node"

export const DocumentProjectionNode =
    /* @__PURE__ */ createProjectionNode<Window>(documentProjectionNodeConfig)
