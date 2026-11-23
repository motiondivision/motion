import { createRenderBatcher } from "./batcher"

const microtaskBatcher = /* @__PURE__ */ createRenderBatcher(
    queueMicrotask,
    false
)

export const microtask = /* @__PURE__ */ (() => microtaskBatcher.schedule)()
export const cancelMicrotask = /* @__PURE__ */ (() => microtaskBatcher.cancel)()
