import { noop } from "motion-utils"
import { createRenderBatcher } from "./batcher"
import { frameData } from "./frame-data"

export { frameData }

export const {
    schedule: frame,
    cancel: cancelFrame,
    steps: frameSteps,
} = /* @__PURE__ */ createRenderBatcher(
    typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : noop,
    true,
    frameData
)
