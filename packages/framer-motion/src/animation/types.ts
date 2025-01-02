import { TargetAndTransition, TargetResolver } from "../types"
import type { VisualElement } from "../render/VisualElement"
import { Easing } from "../easing/types"
import { Driver } from "./animators/drivers/types"
import { SVGPathProperties, VariantLabels } from "../motion/types"
import { SVGAttributes } from "../render/svg/types-attributes"
import { ProgressTimeline } from "../render/dom/scroll/observe"
import type { MotionValue } from "../value"
import {
    KeyframeResolver,
    OnKeyframesResolved,
} from "../render/utils/KeyframesResolver"
import { KeyframeGenerator } from "./generators/types"

export interface AnimationPlaybackLifecycles<V> {
    onUpdate?: (latest: V) => void
    onPlay?: () => void
    onComplete?: () => void
    onRepeat?: () => void
    onStop?: () => void
}

export type GeneratorFactory = (
    options: ValueAnimationOptions<any>
) => KeyframeGenerator<any>

export type AnimationGeneratorType =
    | GeneratorFactory
    | "decay"
    | "spring"
    | "keyframes"
    | "tween"
    | "inertia"

export interface Transition
    extends AnimationPlaybackOptions,
        Omit<SpringOptions, "keyframes">,
        Omit<InertiaOptions, "keyframes">,
        KeyframeOptions {
    delay?: number
    elapsed?: number
    driver?: Driver
    type?: AnimationGeneratorType
    duration?: number
    autoplay?: boolean
    startTime?: number

    /**
     * If set to `true`, when the animated value leaves its current
     * state, this transition will be used.
     *
     * For example:
     *
     * ```jsx
     * <motion.div
     *   animate={{
     *     opacity: 0,
     *     transition: { delay: 1 }
     *   }}
     *   whileHover={{
     *     opacity: 1,
     *     transition: { out: true, duration: 1 }
     *   }}
     * />
     * ```
     *
     * Because `whileHover` has a `transition` where `out` is `true`,
     * when the hover ends, the `duration: 1` transition will be used,
     * with no `delay`.
     *
     * @default false
     */
    out?: boolean
}

export interface ValueAnimationTransition<V = any>
    extends Transition,
        AnimationPlaybackLifecycles<V> {}

export type ResolveKeyframes<V extends string | number> = (
    keyframes: V[],
    onComplete: OnKeyframesResolved<V>,
    name?: string,
    motionValue?: any
) => KeyframeResolver<V>

export interface ValueAnimationOptions<V extends string | number = number>
    extends ValueAnimationTransition {
    keyframes: V[]
    name?: string
    from?: V
    isGenerator?: boolean
}

export interface ValueAnimationOptionsWithRenderContext<
    V extends string | number = number
> extends ValueAnimationOptions<V> {
    KeyframeResolver?: typeof KeyframeResolver
    motionValue?: MotionValue<V>
    element?: VisualElement
}

export type StyleTransitions = {
    [K in keyof CSSStyleDeclarationWithTransform]?: Transition
}

export type SVGPathTransitions = {
    [K in keyof SVGPathProperties]: Transition
}

export type SVGTransitions = {
    [K in keyof SVGAttributes]: Transition
}

export type VariableTransitions = {
    [key: `--${string}`]: Transition
}

export type AnimationOptionsWithValueOverrides<V = any> = StyleTransitions &
    SVGPathTransitions &
    SVGTransitions &
    VariableTransitions &
    ValueAnimationTransition<V>

export interface DynamicAnimationOptions
    extends Omit<AnimationOptionsWithValueOverrides, "delay"> {
    delay?: number | DynamicOption<number>
}

/**
 * @public
 */
export interface AnimationPlaybackControls {
    time: number
    speed: number
    startTime: number | null
    state?: AnimationPlayState

    /*
     * The duration is the duration of time calculated for the active part
     * of the animation without delay or repeat,
     * which may be added as an extra prop at a later date.
     */
    duration: number

    stop: () => void
    play: () => void
    pause: () => void
    complete: () => void
    cancel: () => void
    then: (onResolve: VoidFunction, onReject?: VoidFunction) => Promise<void>
    attachTimeline?: (
        timeline: ProgressTimeline,
        fallback?: (animation: AnimationPlaybackControls) => VoidFunction
    ) => VoidFunction
    flatten: () => void
}

export type DynamicOption<T> = (i: number, total: number) => T

export interface CSSStyleDeclarationWithTransform
    extends Omit<
        CSSStyleDeclaration,
        "direction" | "transition" | "x" | "y" | "z"
    > {
    x: number | string
    y: number | string
    z: number | string
    rotateX: number | string
    rotateY: number | string
    rotateZ: number | string
    scaleX: number
    scaleY: number
    scaleZ: number
    skewX: number | string
    skewY: number | string
}

export type ValueKeyframe = string | number

export type UnresolvedValueKeyframe = ValueKeyframe | null

export type ValueKeyframesDefinition =
    | ValueKeyframe
    | ValueKeyframe[]
    | UnresolvedValueKeyframe[]

export type StyleKeyframesDefinition = {
    [K in keyof CSSStyleDeclarationWithTransform]?: ValueKeyframesDefinition
}

export type SVGKeyframesDefinition = {
    [K in keyof SVGAttributes]?: ValueKeyframesDefinition
}

export type VariableKeyframesDefinition = {
    [key: `--${string}`]: ValueKeyframesDefinition
}

export type SVGPathKeyframesDefinition = {
    [K in keyof SVGPathProperties]?: ValueKeyframesDefinition
}

export type DOMKeyframesDefinition = StyleKeyframesDefinition &
    SVGKeyframesDefinition &
    SVGPathKeyframesDefinition &
    VariableKeyframesDefinition

export interface VelocityOptions {
    velocity?: number
    restSpeed?: number
    restDelta?: number
}

export type RepeatType = "loop" | "reverse" | "mirror"

export interface AnimationPlaybackOptions {
    repeat?: number
    repeatType?: RepeatType
    repeatDelay?: number
}

export interface DurationSpringOptions {
    duration?: number
    visualDuration?: number
    bounce?: number
}

export interface SpringOptions extends DurationSpringOptions, VelocityOptions {
    stiffness?: number
    damping?: number
    mass?: number
}

export interface DecayOptions extends VelocityOptions {
    keyframes?: number[]
    power?: number
    timeConstant?: number
    modifyTarget?: (v: number) => number
}

export interface InertiaOptions extends DecayOptions {
    bounceStiffness?: number
    bounceDamping?: number
    min?: number
    max?: number
}

export interface KeyframeOptions {
    ease?: Easing | Easing[]
    times?: number[]
}

export type AnimationDefinition =
    | VariantLabels
    | TargetAndTransition
    | TargetResolver

/**
 * @public
 */
export interface AnimationControls {
    /**
     * Subscribes a component's animation controls to this.
     *
     * @param controls - The controls to subscribe
     * @returns An unsubscribe function.
     *
     * @internal
     */
    subscribe(visualElement: VisualElement): () => void

    /**
     * Starts an animation on all linked components.
     *
     * @remarks
     *
     * ```jsx
     * controls.start("variantLabel")
     * controls.start({
     *   x: 0,
     *   transition: { duration: 1 }
     * })
     * ```
     *
     * @param definition - Properties or variant label to animate to
     * @param transition - Optional `transtion` to apply to a variant
     * @returns - A `Promise` that resolves when all animations have completed.
     *
     * @public
     */
    start(
        definition: AnimationDefinition,
        transitionOverride?: Transition
    ): Promise<any>

    /**
     * Instantly set to a set of properties or a variant.
     *
     * ```jsx
     * // With properties
     * controls.set({ opacity: 0 })
     *
     * // With variants
     * controls.set("hidden")
     * ```
     *
     * @privateRemarks
     * We could perform a similar trick to `.start` where this can be called before mount
     * and we maintain a list of of pending actions that get applied on mount. But the
     * expectation of `set` is that it happens synchronously and this would be difficult
     * to do before any children have even attached themselves. It's also poor practise
     * and we should discourage render-synchronous `.start` calls rather than lean into this.
     *
     * @public
     */
    set(definition: AnimationDefinition): void

    /**
     * Stops animations on all linked components.
     *
     * ```jsx
     * controls.stop()
     * ```
     *
     * @public
     */
    stop(): void
    mount(): () => void
}
