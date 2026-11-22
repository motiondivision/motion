import { createHTMLProjectionConfig } from "./BasicHTMLProjectionNode"
import { createProjectionNode } from "./create-projection-node"
import { DocumentProjectionNode } from "./DocumentProjectionNode"

export const HTMLProjectionNode =
    /* @__PURE__ */ createProjectionNode<HTMLElement>(
        /* @__PURE__ */ createHTMLProjectionConfig(DocumentProjectionNode)
    )
