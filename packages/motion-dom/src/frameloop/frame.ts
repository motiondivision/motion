import { noop } from "motion-utils"
import { createRenderBatcher } from "./batcher"
import { frameData } from "./frame-data"

const frameBatcher = /* @__PURE__ */ createRenderBatcher(
    typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop,
    true,
    frameData
)

export const frame = /* @__PURE__ */ (() => frameBatcher.schedule)()
export const cancelFrame = /* @__PURE__ */ (() => frameBatcher.cancel)()
export const frameSteps = /* @__PURE__ */ (() => frameBatcher.steps)()
