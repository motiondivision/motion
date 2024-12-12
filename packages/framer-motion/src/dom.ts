export { noop, invariant } from "motion-utils"
export { isDragActive } from "motion-dom"

export { motionValue, MotionValue } from "./value"
export type { PassiveEffect, Subscriber } from "./value"
export type { DynamicAnimationOptions, DOMKeyframesDefinition } from './animation/types'
export { animate, createScopedAnimate } from "./animation/animate"
export { animateMini } from "./animation/animators/waapi/animate-style"
export { scroll } from "./render/dom/scroll"
export { scrollInfo } from "./render/dom/scroll/track"
export { inView } from "./render/dom/viewport"

/**
 * Easing
 */
export * from "./easing/anticipate"
export * from "./easing/back"
export * from "./easing/circ"
export * from "./easing/ease"
export * from "./easing/cubic-bezier"
export * from "./easing/steps"
export * from "./easing/modifiers/mirror"
export * from "./easing/modifiers/reverse"
export * from "./easing/types"

/**
 * Animation generators
 */
export { spring } from "./animation/generators/spring"
export { inertia } from "./animation/generators/inertia"
export { keyframes } from "./animation/generators/keyframes"

/**
 * Utils
 */
export { stagger } from "./animation/utils/stagger"
export { transform } from "./utils/transform"
export { clamp } from "./utils/clamp"
export { delayInSeconds as delay, DelayedFunction } from "./utils/delay"
export * from "./utils/distance"
export * from "./utils/interpolate"
export { mix } from "./utils/mix"
export { pipe } from "./utils/pipe"
export { progress } from "./utils/progress"
export { wrap } from "./utils/wrap"
export * from "./frameloop"

/**
 * Types
 */

export * from "./animation/types"
export * from "./animation/sequence/types"
export * from "./projection/geometry/types"

/**
 * Deprecated
 */
export { sync, cancelSync } from "./frameloop/index-legacy"
