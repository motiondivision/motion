import type {
    AnimationDefinition,
    MotionNodeOptions,
    ResolvedValues,
    VariantLabels,
} from "../node/types"
import type { AnyResolvedKeyframe, Transition } from "../animation/types"
import type { MotionValue } from "../value"
import type { Axis, Box, TransformPoint } from "motion-utils"

// Re-export types for convenience
export type { ResolvedValues }

/**
 * @public
 */
export interface PresenceContextProps {
    id: string
    isPresent: boolean
    register: (id: string | number) => () => void
    onExitComplete?: (id: string | number) => void
    initial?: false | VariantLabels
    custom?: any
}

/**
 * @public
 */
export type ReducedMotionConfig = "always" | "never" | "user"

/**
 * @public
 */
export interface MotionConfigContextProps {
    /**
     * Internal, exported only for usage in Framer
     */
    transformPagePoint: TransformPoint

    /**
     * Internal. Determines whether this is a static context ie the Framer canvas. If so,
     * it'll disable all dynamic functionality.
     */
    isStatic: boolean

    /**
     * Defines a new default transition for the entire tree.
     *
     * @public
     */
    transition?: Transition

    /**
     * If true, will respect the device prefersReducedMotion setting by switching
     * transform animations off.
     *
     * @public
     */
    reducedMotion?: ReducedMotionConfig

    /**
     * A custom `nonce` attribute used when wanting to enforce a Content Security Policy (CSP).
     * For more details see:
     * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/style-src#unsafe_inline_styles
     *
     * @public
     */
    nonce?: string
}

export interface VisualState<_Instance, RenderState> {
    latestValues: ResolvedValues
    renderState: RenderState
}

export interface VisualElementOptions<Instance, RenderState = any> {
    visualState: VisualState<Instance, RenderState>
    parent?: any // VisualElement<unknown> - circular reference handled at runtime
    variantParent?: any
    presenceContext: PresenceContextProps | null
    props: MotionNodeOptions
    blockInitialAnimation?: boolean
    reducedMotionConfig?: ReducedMotionConfig
    /**
     * Explicit override for SVG detection. When true, uses SVG rendering;
     * when false, uses HTML rendering. If undefined, auto-detects.
     */
    isSVG?: boolean
}

export interface VisualElementEventCallbacks {
    BeforeLayoutMeasure: () => void
    LayoutMeasure: (layout: Box, prevLayout?: Box) => void
    LayoutUpdate: (layout: Axis, prevLayout: Axis) => void
    Update: (latest: ResolvedValues) => void
    AnimationStart: (definition: AnimationDefinition) => void
    AnimationComplete: (definition: AnimationDefinition) => void
    LayoutAnimationStart: () => void
    LayoutAnimationComplete: () => void
    SetAxisTarget: () => void
    Unmount: () => void
}

export interface LayoutLifecycles {
    onBeforeLayoutMeasure?(box: Box): void
    onLayoutMeasure?(box: Box, prevBox: Box): void
    /**
     * @internal
     */
    onLayoutAnimationStart?(): void
    /**
     * @internal
     */
    onLayoutAnimationComplete?(): void
}

export type ScrapeMotionValuesFromProps = (
    props: MotionNodeOptions,
    prevProps: MotionNodeOptions,
    visualElement?: any
) => {
    [key: string]: MotionValue | AnyResolvedKeyframe
}

export type UseRenderState<RenderState = any> = () => RenderState

/**
 * Animation type for variant state management
 */
export type AnimationType =
    | "animate"
    | "whileHover"
    | "whileTap"
    | "whileDrag"
    | "whileFocus"
    | "whileInView"
    | "exit"

export interface FeatureClass<Props = unknown> {
    new (props: Props): any
}

export interface FeatureDefinition {
    isEnabled: (props: MotionNodeOptions) => boolean
    Feature?: FeatureClass<unknown>
}

export type FeatureDefinitions = {
    animation?: FeatureDefinition
    exit?: FeatureDefinition
    drag?: FeatureDefinition
    tap?: FeatureDefinition
    focus?: FeatureDefinition
    hover?: FeatureDefinition
    pan?: FeatureDefinition
    inView?: FeatureDefinition
    layout?: FeatureDefinition
}
