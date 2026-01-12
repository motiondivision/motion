export * from "./animation/AsyncMotionValueAnimation"
export * from "./animation/GroupAnimation"
export * from "./animation/GroupAnimationWithThen"
export * from "./animation/JSAnimation"
export * from "./animation/NativeAnimation"
export * from "./animation/NativeAnimationExtended"
export * from "./animation/NativeAnimationWrapper"
export * from "./animation/types"
export * from "./animation/utils/active-animations"
export * from "./animation/utils/css-variables-conversion"
export * from "./animation/utils/get-value-transition"
export * from "./animation/utils/is-css-variable"
export * from "./animation/utils/make-animation-instant"

export * from "./animation/generators/inertia"
export * from "./animation/generators/keyframes"
export * from "./animation/generators/spring"
export * from "./animation/generators/utils/calc-duration"
export * from "./animation/generators/utils/create-generator-easing"
export * from "./animation/generators/utils/is-generator"

export * from "./animation/keyframes/DOMKeyframesResolver"
export * from "./animation/keyframes/KeyframesResolver"
export * from "./animation/keyframes/offsets/default"
export * from "./animation/keyframes/offsets/fill"
export * from "./animation/keyframes/offsets/time"
export * from "./animation/keyframes/utils/apply-px-defaults"
export * from "./animation/keyframes/utils/fill-wildcards"

export * from "./animation/waapi/easing/cubic-bezier"
export * from "./animation/waapi/easing/is-supported"
export * from "./animation/waapi/easing/map-easing"
export * from "./animation/waapi/easing/supported"
export * from "./animation/waapi/start-waapi-animation"
export * from "./animation/waapi/supports/partial-keyframes"
export * from "./animation/waapi/supports/waapi"
export * from "./animation/waapi/utils/accelerated-values"
export * from "./animation/waapi/utils/apply-generator"
export * from "./animation/waapi/utils/linear"

export * from "./effects/attr"
export * from "./effects/prop"
export * from "./effects/style"
export * from "./effects/svg"

export * from "./frameloop"
export * from "./frameloop/batcher"
export * from "./frameloop/microtask"
export * from "./frameloop/sync-time"
export * from "./frameloop/types"

export * from "./gestures/drag/state/is-active"
export * from "./gestures/drag/state/set-active"
export * from "./gestures/drag/types"
export * from "./gestures/hover"
export * from "./gestures/pan/types"
export * from "./gestures/press"
export * from "./gestures/press/types"
export * from "./gestures/press/utils/is-keyboard-accessible"
export * from "./gestures/types"
export * from "./gestures/utils/is-node-or-child"
export * from "./gestures/utils/is-primary-pointer"

export * from "./node/types"

export * from "./render/dom/parse-transform"
export * from "./render/dom/style-computed"
export * from "./render/dom/style-set"
export * from "./render/svg/types"
export * from "./render/utils/keys-position"
export * from "./render/utils/keys-transform"

export * from "./resize"

export * from "./scroll/observe"

export * from "./stats"
export * from "./stats/animation-count"
export * from "./stats/buffer"
export * from "./stats/types"

export * from "./utils/interpolate"
export * from "./utils/is-html-element"
export * from "./utils/is-svg-element"
export * from "./utils/is-svg-svg-element"
export * from "./utils/mix"
export * from "./utils/mix/color"
export * from "./utils/mix/complex"
export * from "./utils/mix/immediate"
export * from "./utils/mix/number"
export * from "./utils/mix/types"
export * from "./utils/mix/visibility"
export * from "./utils/resolve-elements"
export * from "./utils/stagger"
export * from "./utils/supports/flags"
export * from "./utils/supports/linear-easing"
export * from "./utils/supports/scroll-timeline"
export * from "./utils/transform"

export * from "./value"
export * from "./value/map-value"
export * from "./value/spring-value"
export * from "./value/transform-value"
export * from "./value/types/color"
export * from "./value/types/color/hex"
export * from "./value/types/color/hsla"
export * from "./value/types/color/hsla-to-rgba"
export * from "./value/types/color/rgba"
export * from "./value/types/complex"
export * from "./value/types/dimensions"
export * from "./value/types/maps/defaults"
export * from "./value/types/maps/number"
export * from "./value/types/maps/transform"
export * from "./value/types/maps/types"
export * from "./value/types/numbers"
export * from "./value/types/numbers/units"
export * from "./value/types/test"
export * from "./value/types/types"
export * from "./value/types/utils/animatable-none"
export * from "./value/types/utils/find"
export * from "./value/types/utils/get-as-type"
export * from "./value/utils/is-motion-value"

export * from "./view"
export * from "./view/types"
export * from "./view/utils/get-layer-info"
export * from "./view/utils/get-view-animations"

// Visual Element
export { VisualElement, setFeatureDefinitions, getFeatureDefinitions } from "./render/VisualElement"
export type { MotionStyle } from "./render/VisualElement"
export { Feature } from "./render/Feature"
export { DOMVisualElement } from "./render/dom/DOMVisualElement"
export { HTMLVisualElement } from "./render/html/HTMLVisualElement"
export { SVGVisualElement } from "./render/svg/SVGVisualElement"
export { ObjectVisualElement } from "./render/object/ObjectVisualElement"
export { visualElementStore } from "./render/store"
export type {
    ResolvedValues,
    PresenceContextProps,
    ReducedMotionConfig,
    MotionConfigContextProps,
    VisualState,
    VisualElementOptions,
    VisualElementEventCallbacks,
    LayoutLifecycles,
    ScrapeMotionValuesFromProps,
    UseRenderState,
    AnimationType,
    FeatureClass,
} from "./render/types"
export * from "./render/dom/types"
export * from "./render/html/types"

// Animation State
export { createAnimationState, checkVariantsDidChange } from "./render/utils/animation-state"
export type { AnimationState, AnimationTypeState, AnimationList } from "./render/utils/animation-state"

// Variant utilities
export { isVariantLabel } from "./render/utils/is-variant-label"
export { isControllingVariants, isVariantNode } from "./render/utils/is-controlling-variants"
export { getVariantContext } from "./render/utils/get-variant-context"
export { resolveVariantFromProps } from "./render/utils/resolve-variants"
export { resolveVariant } from "./render/utils/resolve-dynamic-variants"
export { updateMotionValuesFromProps } from "./render/utils/motion-values"
export { variantProps, variantPriorityOrder } from "./render/utils/variant-props"
export { isAnimationControls } from "./render/utils/is-animation-controls"
export { isForcedMotionValue, scaleCorrectors, addScaleCorrectors } from "./render/utils/is-forced-motion-value"

// Reduced motion
export {
    initPrefersReducedMotion,
    hasReducedMotionListener,
    prefersReducedMotion,
} from "./render/utils/reduced-motion"

// Projection geometry
export * from "./projection/geometry"
export { hasTransform, hasScale, has2DTranslate } from "./projection/utils/has-transform"
export { measureViewportBox, measurePageBox } from "./projection/utils/measure"
export { eachAxis } from "./projection/utils/each-axis"

// Projection styles
export * from "./projection/styles/types"
export { pixelsToPercent, correctBorderRadius } from "./projection/styles/scale-border-radius"
export { correctBoxShadow } from "./projection/styles/scale-box-shadow"
export { buildProjectionTransform } from "./projection/styles/transform"

// Projection animation
export { mixValues } from "./projection/animation/mix-values"

// HTML/SVG utilities
export { buildHTMLStyles } from "./render/html/utils/build-styles"
export { buildTransform } from "./render/html/utils/build-transform"
export { renderHTML } from "./render/html/utils/render"
export { buildSVGAttrs } from "./render/svg/utils/build-attrs"
export { renderSVG } from "./render/svg/utils/render"
export { buildSVGPath } from "./render/svg/utils/path"
export { camelCaseAttributes } from "./render/svg/utils/camel-case-attrs"
export { isSVGTag } from "./render/svg/utils/is-svg-tag"
export { camelToDash } from "./render/dom/utils/camel-to-dash"

/**
 * Deprecated
 */
export { cancelSync, sync } from "./frameloop/index-legacy"
