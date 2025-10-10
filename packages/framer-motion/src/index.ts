/**
 * Components
 */
export type * from "./animation/types"
export { AnimatePresence } from "./components/AnimatePresence"
export { PopChild } from "./components/AnimatePresence/PopChild"
export { PresenceChild } from "./components/AnimatePresence/PresenceChild"
export { LayoutGroup } from "./components/LayoutGroup"
export { LazyMotion } from "./components/LazyMotion"
export { MotionConfig } from "./components/MotionConfig"
export { Reorder } from "./components/Reorder"
export * from "./dom"
export { m } from "./render/components/m/proxy"
export { motion } from "./render/components/motion/proxy"
export type {
    ResolvedValues,
    ScrapeMotionValuesFromProps,
} from "./render/types"

export { addPointerEvent } from "./events/add-pointer-event"
export { addPointerInfo } from "./events/event-info"
export { animations } from "./motion/features/animations"
export {
    makeUseVisualState,
    VisualState,
} from "./motion/utils/use-visual-state"
export { calcLength } from "./projection/geometry/delta-calc"
export { createBox } from "./projection/geometry/models"
export { filterProps } from "./render/dom/utils/filter-props"
export { AnimationType } from "./render/utils/types"
export { isBrowser } from "./utils/is-browser"
export { useComposedRefs } from "./utils/use-composed-ref"
export { useForceUpdate } from "./utils/use-force-update"
export { useIsomorphicLayoutEffect } from "./utils/use-isomorphic-effect"
export { useUnmountEffect } from "./utils/use-unmount-effect"

/**
 * Features
 */
export { domAnimation } from "./render/dom/features-animation"
export { domMax } from "./render/dom/features-max"
export { domMin } from "./render/dom/features-min"

/**
 * Motion values
 */
export { useMotionValueEvent } from "./utils/use-motion-value-event"
export { useElementScroll } from "./value/scroll/use-element-scroll"
export { useViewportScroll } from "./value/scroll/use-viewport-scroll"
export { useMotionTemplate } from "./value/use-motion-template"
export { useMotionValue } from "./value/use-motion-value"
export { useScroll, UseScrollOptions } from "./value/use-scroll"
export { useSpring } from "./value/use-spring"
export { useTime } from "./value/use-time"
export { useTransform } from "./value/use-transform"
export { useVelocity } from "./value/use-velocity"
export { useWillChange } from "./value/use-will-change"
export { WillChangeMotionValue } from "./value/use-will-change/WillChangeMotionValue"
export { resolveMotionValue } from "./value/utils/resolve-motion-value"

/**
 * Accessibility
 */
export { useReducedMotion } from "./utils/reduced-motion/use-reduced-motion"
export { useReducedMotionConfig } from "./utils/reduced-motion/use-reduced-motion-config"

/**
 * Utils
 */
export { MotionGlobalConfig } from "motion-utils"
export { animationControls } from "./animation/hooks/animation-controls"
export { useAnimate } from "./animation/hooks/use-animate"
export { useAnimateMini } from "./animation/hooks/use-animate-style"
export {
    useAnimation,
    useAnimationControls,
} from "./animation/hooks/use-animation"
export { animateVisualElement } from "./animation/interfaces/visual-element"
export {
    useIsPresent,
    usePresence,
} from "./components/AnimatePresence/use-presence"
export { usePresenceData } from "./components/AnimatePresence/use-presence-data"
export { useDomEvent } from "./events/use-dom-event"
export {
    DragControls,
    useDragControls,
} from "./gestures/drag/use-drag-controls"
export { isMotionComponent } from "./motion/utils/is-motion-component"
export { unwrapMotionComponent } from "./motion/utils/unwrap-motion-component"
export { isValidMotionProp } from "./motion/utils/valid-prop"
export { addScaleCorrector } from "./projection/styles/scale-correction"
export { useInstantLayoutTransition } from "./projection/use-instant-layout-transition"
export { useResetProjection } from "./projection/use-reset-projection"
export { buildTransform } from "./render/html/utils/build-transform"
export { visualElementStore } from "./render/store"
export { VisualElement } from "./render/VisualElement"
export { useAnimationFrame } from "./utils/use-animation-frame"
export { Cycle, CycleState, useCycle } from "./utils/use-cycle"
export { useInView, UseInViewOptions } from "./utils/use-in-view"
export {
    disableInstantTransitions,
    useInstantTransition,
} from "./utils/use-instant-transition"
export { usePageInView } from "./utils/use-page-in-view"

/**
 * Appear animations
 */
export { optimizedAppearDataAttribute } from "./animation/optimized-appear/data-id"
export { startOptimizedAppearAnimation } from "./animation/optimized-appear/start"

/**
 * Contexts
 */
export { LayoutGroupContext } from "./context/LayoutGroupContext"
export { MotionConfigContext } from "./context/MotionConfigContext"
export { MotionContext } from "./context/MotionContext"
export { PresenceContext } from "./context/PresenceContext"
export { SwitchLayoutGroupContext } from "./context/SwitchLayoutGroupContext"

/**
 * Types
 */
export type { AnimatePresenceProps } from "./components/AnimatePresence/types"
export type { LazyProps } from "./components/LazyMotion/types"
export type { MotionConfigProps } from "./components/MotionConfig"
export type * from "./motion/features/types"
export type {
    MotionProps,
    MotionStyle,
    MotionTransform,
    VariantLabels,
} from "./motion/types"
export type { IProjectionNode } from "./projection/node/types"
export type { DOMMotionComponents } from "./render/dom/types"
export type { ForwardRefComponent, HTMLMotionProps } from "./render/html/types"
export type {
    SVGAttributesAsMotionValues,
    SVGMotionProps,
} from "./render/svg/types"
export type { CreateVisualElement } from "./render/types"
export type { FlatTree } from "./render/utils/flat-tree"
export type { ScrollMotionValues } from "./value/scroll/utils"

/**
 * Deprecated
 */
export { useAnimatedState as useDeprecatedAnimatedState } from "./animation/hooks/use-animated-state"
export { AnimateSharedLayout } from "./components/AnimateSharedLayout"
export { DeprecatedLayoutGroupContext } from "./context/DeprecatedLayoutGroupContext"
export { useInvertedScale as useDeprecatedInvertedScale } from "./value/use-inverted-scale"

// Keep explict delay in milliseconds export for BC with Framer
export { delay, DelayedFunction } from "./utils/delay"
