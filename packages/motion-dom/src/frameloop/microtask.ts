import { createRenderBatcher } from "./batcher"

export const { schedule: microtask, cancel: cancelMicrotask } =
    /* @__PURE__ */ createRenderBatcher(queueMicrotask, false)
