export * from "./animation/AsyncMotionValueAnimation"
export * from "./animation/GroupAnimation"
export * from "./animation/GroupAnimationWithThen"
export * from "./animation/JSAnimation"
export * from "./animation/NativeAnimation"
export * from "./animation/NativeAnimationExtended"
export * from "./animation/NativeAnimationWrapper"
export * from "./animation/SequenceCallbackAnimation"
export * from "./animation/types"
export * from "./animation/utils/active-animations"
export { calcChildStagger } from "./animation/utils/calc-child-stagger"
export * from "./animation/utils/css-variables-conversion"
export { getDefaultTransition } from "./animation/utils/default-transitions"
export { getFinalKeyframe } from "./animation/utils/get-final-keyframe"
export * from "./animation/utils/get-value-transition"
export * from "./animation/utils/is-css-variable"
export { isTransitionDefined } from "./animation/utils/is-transition-defined"
export * from "./animation/utils/make-animation-instant"

// Animation interfaces
export { animateMotionValue } from "./animation/interfaces/motion-value"
export type { VisualElementAnimationOptions } from "./animation/interfaces/types"
export { animateVisualElement } from "./animation/interfaces/visual-element"
export { animateTarget } from "./animation/interfaces/visual-element-target"
export { animateVariant } from "./animation/interfaces/visual-element-variant"

// Optimized appear
export {
    optimizedAppearDataAttribute,
    optimizedAppearDataId,
} from "./animation/optimized-appear/data-id"
export { getOptimisedAppearId } from "./animation/optimized-appear/get-appear-id"
export type {
    HandoffFunction,
    WithAppearProps,
} from "./animation/optimized-appear/types"

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
export { isKeyframesTarget } from "./render/utils/is-keyframes-target"
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
export * from "./value/follow-value"
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
export { addValueToWillChange } from "./value/will-change/add-will-change"
export { isWillChangeMotionValue } from "./value/will-change/is"
export type { WillChange } from "./value/will-change/types"

export * from "./view"
export * from "./view/types"
export * from "./view/utils/get-layer-info"
export * from "./view/utils/get-view-animations"

// Visual Element
export { DOMVisualElement } from "./render/dom/DOMVisualElement"
export * from "./render/dom/types"
export { Feature } from "./render/Feature"
export { HTMLVisualElement } from "./render/html/HTMLVisualElement"
export * from "./render/html/types"
export { ObjectVisualElement } from "./render/object/ObjectVisualElement"
export { visualElementStore } from "./render/store"
export { SVGVisualElement } from "./render/svg/SVGVisualElement"
export type {
    AnimationType,
    FeatureClass,
    LayoutLifecycles,
    MotionConfigContextProps,
    PresenceContextProps,
    ReducedMotionConfig,
    ResolvedValues,
    ScrapeMotionValuesFromProps,
    UseRenderState,
    VisualElementEventCallbacks,
    VisualElementOptions,
    VisualState,
} from "./render/types"
export {
    getFeatureDefinitions,
    setFeatureDefinitions,
    VisualElement,
} from "./render/VisualElement"
export type { MotionStyle } from "./render/VisualElement"

// Animation State
export {
    checkVariantsDidChange,
    createAnimationState,
} from "./render/utils/animation-state"
export type {
    AnimationList,
    AnimationState,
    AnimationTypeState,
} from "./render/utils/animation-state"

// Variant utilities
export { getVariantContext } from "./render/utils/get-variant-context"
export { isAnimationControls } from "./render/utils/is-animation-controls"
export {
    isControllingVariants,
    isVariantNode,
} from "./render/utils/is-controlling-variants"
export {
    addScaleCorrector,
    isForcedMotionValue,
    scaleCorrectors,
} from "./render/utils/is-forced-motion-value"
export { isVariantLabel } from "./render/utils/is-variant-label"
export { updateMotionValuesFromProps } from "./render/utils/motion-values"
export { resolveVariant } from "./render/utils/resolve-dynamic-variants"
export { resolveVariantFromProps } from "./render/utils/resolve-variants"
export { setTarget } from "./render/utils/setters"
export {
    variantPriorityOrder,
    variantProps,
} from "./render/utils/variant-props"

// Reduced motion
export {
    hasReducedMotionListener,
    initPrefersReducedMotion,
    prefersReducedMotion,
} from "./render/utils/reduced-motion"

// Projection geometry
export * from "./projection/geometry/conversion"
export * from "./projection/geometry/copy"
export * from "./projection/geometry/delta-apply"
export * from "./projection/geometry/delta-calc"
export * from "./projection/geometry/delta-remove"
export * from "./projection/geometry/models"
export * from "./projection/geometry/utils"
export { eachAxis } from "./projection/utils/each-axis"
export {
    has2DTranslate,
    hasScale,
    hasTransform,
} from "./projection/utils/has-transform"
export { measurePageBox, measureViewportBox } from "./projection/utils/measure"

// Projection styles
export {
    correctBorderRadius,
    pixelsToPercent,
} from "./projection/styles/scale-border-radius"
export { correctBoxShadow } from "./projection/styles/scale-box-shadow"
export { buildProjectionTransform } from "./projection/styles/transform"
export * from "./projection/styles/types"

// Projection animation
export { mixValues } from "./projection/animation/mix-values"

// Utilities (used by projection system)
export { animateSingleValue } from "./animation/animate/single-value"
export { addDomEvent } from "./events/add-dom-event"
export { compareByDepth } from "./projection/utils/compare-by-depth"
export type { WithDepth } from "./projection/utils/compare-by-depth"
export { FlatTree } from "./projection/utils/flat-tree"
export { delay, delayInSeconds } from "./utils/delay"
export type { DelayedFunction } from "./utils/delay"
export { resolveMotionValue } from "./value/utils/resolve-motion-value"

// Projection node system
export {
    cleanDirtyNodes,
    createProjectionNode,
    propagateDirtyNodes,
} from "./projection/node/create-projection-node"
export { DocumentProjectionNode } from "./projection/node/DocumentProjectionNode"
export { nodeGroup } from "./projection/node/group"
export type { NodeGroup } from "./projection/node/group"
export {
    HTMLProjectionNode,
    rootProjectionNode,
} from "./projection/node/HTMLProjectionNode"
export { globalProjectionState } from "./projection/node/state"
export type {
    InitialPromotionConfig,
    IProjectionNode,
    LayoutEvents,
    LayoutUpdateData,
    LayoutUpdateHandler,
    Measurements,
    Phase,
    ProjectionEventName,
    ProjectionNodeConfig,
    ProjectionNodeOptions,
    ScrollMeasurements,
} from "./projection/node/types"
export { NodeStack } from "./projection/shared/stack"

// HTML/SVG utilities
export { camelToDash } from "./render/dom/utils/camel-to-dash"
export { buildHTMLStyles } from "./render/html/utils/build-styles"
export { buildTransform } from "./render/html/utils/build-transform"
export { renderHTML } from "./render/html/utils/render"
export { scrapeMotionValuesFromProps as scrapeHTMLMotionValuesFromProps } from "./render/html/utils/scrape-motion-values"
export { buildSVGAttrs } from "./render/svg/utils/build-attrs"
export { camelCaseAttributes } from "./render/svg/utils/camel-case-attrs"
export { isSVGTag } from "./render/svg/utils/is-svg-tag"
export { buildSVGPath } from "./render/svg/utils/path"
export { renderSVG } from "./render/svg/utils/render"
export { scrapeMotionValuesFromProps as scrapeSVGMotionValuesFromProps } from "./render/svg/utils/scrape-motion-values"

/**
 * Layout animations
 */
export {
    LayoutAnimationBuilder,
    parseAnimateLayoutArgs,
} from "./layout/LayoutAnimationBuilder"

/**
 * Deprecated
 */
export { cancelSync, sync } from "./frameloop/index-legacy"
