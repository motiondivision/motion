export * from "motion-dom"
export * from "motion-utils"

export { animate, createScopedAnimate } from "./animation/animate"
export { animateMini } from "./animation/animators/waapi/animate-style"
export { scroll } from "./render/dom/scroll"
export { scrollInfo } from "./render/dom/scroll/track"
export { inView } from "./render/dom/viewport"
export { HTMLElements } from "./render/html/supported-elements"
export { initVanillaLayout } from "./layout/init"

// Auto-initialize the layout system for vanilla usage
import { initVanillaLayout } from "./layout/init"
initVanillaLayout()

/**
 * Types
 */
export * from "./animation/sequence/types"

/**
 * Utils
 */
export { delayInSeconds as delay, DelayedFunction } from "./utils/delay"
export * from "./utils/distance"
