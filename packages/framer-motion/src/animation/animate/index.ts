import { addEffect, domEffect, removeEffect } from "motion-dom"
import { createCoreScopedAnimate, ScopedAnimateOptions } from "./core"

export { createCoreScopedAnimate }

/**
 * Creates an animation function that is optionally scoped
 * to a specific element.
 */
export function createScopedAnimate(options: ScopedAnimateOptions = {}) {
    addEffect(domEffect)
    return createCoreScopedAnimate(options)
}

export const animate = /* @__PURE__ */ Object.assign(
    /* @__PURE__ */ createScopedAnimate(),
    {
        /**
         * Register an effect so `animate()` can animate the subjects it
         * claims, for instance `animate.addEffect(threeEffect)`. The most
         * recently added effect is tested first. DOM elements are always
         * animated directly.
         */
        addEffect,
        removeEffect,
    }
)
