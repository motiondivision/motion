import { addEffect, removeEffect } from "motion-dom"
import { createCoreScopedAnimate } from "./animation/animate/core"

/**
 * animate() for numbers, colours, complex strings, motion values and
 * plain objects. To animate DOM elements too:
 *
 *   import { domEffect } from "motion"
 *   animate.addEffect(domEffect)
 */
export const animate = /* @__PURE__ */ Object.assign(
    /* @__PURE__ */ createCoreScopedAnimate(),
    { addEffect, removeEffect }
)
