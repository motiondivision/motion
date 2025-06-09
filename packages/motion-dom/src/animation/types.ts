import { Easing } from "motion-utils"
import { SVGAttributes } from "../render/svg/types"
import { MotionValue } from "../value"
import { Driver } from "./drivers/types"
import { KeyframeResolver } from "./keyframes/KeyframesResolver"
import { WithRender } from "./keyframes/types"

export interface ProgressTimeline {
    currentTime: null | { value: number }

    cancel?: VoidFunction
}

export interface ValueAnimationOptionsWithRenderContext<
    V extends string | number = number
> extends ValueAnimationOptions<V> {
    KeyframeResolver?: typeof KeyframeResolver
    motionValue?: MotionValue<V>
    element?: WithRender
}

export interface TimelineWithFallback {
    timeline?: ProgressTimeline
    observe: (animation: AnimationPlaybackControls) => VoidFunction
}

/**
 * Methods to control an animation.
 */
export interface AnimationPlaybackControls {
    /**
     * The current time of the animation, in seconds.
     */
    time: number

    /**
     * The playback speed of the animation.
     * 1 = normal speed, 2 = double speed, 0.5 = half speed.
     */
    speed: number

    /**
     * The start time of the animation, in milliseconds.
     */
    startTime: number | null

    /**
     * The state of the animation.
     *
     * This is currently for internal use only.
     */
    state: AnimationPlayState

    /*
     * Duration of the animation, in seconds. This can be
     * different from the duration defined in the animation options,
     * for example if it's a spring animation, or the controls
     * represent a group of animations with different durations.
     */
    duration: number

    /**
     * Stops the animation at its current state, and prevents it from
     * resuming when the animation is played again.
     */
    stop: () => void

    /**
     * Plays the animation.
     */
    play: () => void

    /**
     * Pauses the animation.
     */
    pause: () => void

    /**
     * Completes the animation and applies the final state.
     */
    complete: () => void

    /**
     * Cancels the animation and applies the initial state.
     */
    cancel: () => void

    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     *
     * This is currently for internal use only.
     */
    attachTimeline: (timeline: TimelineWithFallback) => VoidFunction

    finished: Promise<any>
}

export type AnimationPlaybackControlsWithThen = AnimationPlaybackControls & {
    then: (onResolve: VoidFunction, onReject?: VoidFunction) => Promise<void>
}

export interface AnimationState<V> {
    value: V
    done: boolean
}

export interface KeyframeGenerator<V> {
    calculatedDuration: null | number
    next: (t: number) => AnimationState<V>
    toString: () => string
}

export interface DOMValueAnimationOptions<V extends string | number = number>
    extends ValueAnimationTransition<V> {
    element: HTMLElement | SVGElement
    keyframes: ValueKeyframesDefinition
    name: string
    pseudoElement?: string
    allowFlatten?: boolean
}

export interface ValueAnimationOptions<V extends string | number = number>
    extends ValueAnimationTransition {
    keyframes: V[]
    element?: any // TODO: Replace with VisualElement when moved into motion-dom
    name?: string
    motionValue?: MotionValue<V>
    from?: V
    isHandoff?: boolean
    allowFlatten?: boolean
    finalKeyframe?: V
}

export type GeneratorFactoryFunction = (
    options: ValueAnimationOptions<any>
) => KeyframeGenerator<any>

export interface GeneratorFactory extends GeneratorFactoryFunction {
    applyToOptions?: (options: Transition) => Transition
}

export type AnimationGeneratorType =
    | GeneratorFactory
    | "decay"
    | "spring"
    | "keyframes"
    | "tween"
    | "inertia"

export interface AnimationPlaybackLifecycles<V> {
    onUpdate?: (latest: V) => void
    onPlay?: () => void
    onComplete?: () => void
    onRepeat?: () => void
    onStop?: () => void

    // @internal
    onCancel?: () => void
}

export interface ValueAnimationTransition<V = any>
    extends Transition,
        AnimationPlaybackLifecycles<V> {
    isSync?: boolean
}

export type RepeatType = "loop" | "reverse" | "mirror"

export interface AnimationPlaybackOptions {
    /**
     * The number of times to repeat the transition. Set to `Infinity` for perpetual repeating.
     *
     * Without setting `repeatType`, this will loop the animation.
     *
     * @public
     */
    repeat?: number

    /**
     * How to repeat the animation. This can be either:
     *
     * "loop": Repeats the animation from the start
     *
     * "reverse": Alternates between forward and backwards playback
     *
     * "mirror": Switches `from` and `to` alternately
     *
     * @public
     */
    repeatType?: RepeatType

    /**
     * When repeating an animation, `repeatDelay` will set the
     * duration of the time to wait, in seconds, between each repetition.
     *
     * @public
     */
    repeatDelay?: number
}

export interface VelocityOptions {
    velocity?: number

    /**
     * End animation if absolute speed (in units per second) drops below this
     * value and delta is smaller than `restDelta`. Set to `0.01` by default.
     *
     * @public
     */
    restSpeed?: number

    /**
     * End animation if distance is below this value and speed is below
     * `restSpeed`. When animation ends, spring gets "snapped" to. Set to
     * `0.01` by default.
     *
     * @public
     */
    restDelta?: number
}
export interface DurationSpringOptions {
    /**
     * The total duration of the animation. Set to `0.3` by default.
     *
     * @public
     */
    duration?: number

    /**
     * If visualDuration is set, this will override duration.
     *
     * The visual duration is a time, set in seconds, that the animation will take to visually appear to reach its target.
     *
     * In other words, the bulk of the transition will occur before this time, and the "bouncy bit" will mostly happen after.
     *
     * This makes it easier to edit a spring, as well as visually coordinate it with other time-based animations.
     *
     * @public
     */
    visualDuration?: number

    /**
     * `bounce` determines the "bounciness" of a spring animation.
     *
     * `0` is no bounce, and `1` is extremely bouncy.
     *
     * If `duration` is set, this defaults to `0.25`.
     *
     * Note: `bounce` and `duration` will be overridden if `stiffness`, `damping` or `mass` are set.
     *
     * @public
     */
    bounce?: number
}

export interface SpringOptions extends DurationSpringOptions, VelocityOptions {
    /**
     * Stiffness of the spring. Higher values will create more sudden movement.
     * Set to `100` by default.
     *
     * @public
     */
    stiffness?: number

    /**
     * Strength of opposing force. If set to 0, spring will oscillate
     * indefinitely. Set to `10` by default.
     *
     * @public
     */
    damping?: number

    /**
     * Mass of the moving object. Higher values will result in more lethargic
     * movement. Set to `1` by default.
     *
     * @public
     */
    mass?: number
}

export interface DecayOptions extends VelocityOptions {
    keyframes?: number[]

    /**
     * A higher power value equals a further target. Set to `0.8` by default.
     *
     * @public
     */
    power?: number
    /**
     * Adjusting the time constant will change the duration of the
     * deceleration, thereby affecting its feel. Set to `700` by default.
     *
     * @public
     */
    timeConstant?: number

    /**
     * A function that receives the automatically-calculated target and returns a new one. Useful for snapping the target to a grid.
     *
     * @public
     */
    modifyTarget?: (v: number) => number
}

export interface InertiaOptions extends DecayOptions {
    /**
     * If `min` or `max` is set, this affects the stiffness of the bounce
     * spring. Higher values will create more sudden movement. Set to `500` by
     * default.
     *
     * @public
     */
    bounceStiffness?: number

    /**
     * If `min` or `max` is set, this affects the damping of the bounce spring.
     * If set to `0`, spring will oscillate indefinitely. Set to `10` by
     * default.
     *
     * @public
     */
    bounceDamping?: number

    /**
     * Minimum constraint. If set, the value will "bump" against this value (or immediately spring to it if the animation starts as less than this value).
     *
     * @public
     */
    min?: number

    /**
     * Maximum constraint. If set, the value will "bump" against this value (or immediately snap to it, if the initial animation value exceeds this value).
     *
     * @public
     */
    max?: number
}

export interface AnimationOrchestrationOptions {
    /**
     * Delay the animation by this duration (in seconds). Defaults to `0`.
     *
     * @public
     */
    delay?: number

    /**
     * Describes the relationship between the transition and its children. Set
     * to `false` by default.
     *
     * @remarks
     * When using variants, the transition can be scheduled in relation to its
     * children with either `"beforeChildren"` to finish this transition before
     * starting children transitions, `"afterChildren"` to finish children
     * transitions before starting this transition.
     *
     * @public
     */
    when?: false | "beforeChildren" | "afterChildren" | string

    /**
     * When using variants, children animations will start after this duration
     * (in seconds). You can add the `transition` property to both the `Frame` and the `variant` directly. Adding it to the `variant` generally offers more flexibility, as it allows you to customize the delay per visual state.
     *
     * @public
     */
    delayChildren?: number

    /**
     * When using variants, animations of child components can be staggered by this
     * duration (in seconds).
     *
     * For instance, if `staggerChildren` is `0.01`, the first child will be
     * delayed by `0` seconds, the second by `0.01`, the third by `0.02` and so
     * on.
     *
     * The calculated stagger delay will be added to `delayChildren`.
     *
     * @public
     */
    staggerChildren?: number

    /**
     * The direction in which to stagger children.
     *
     * A value of `1` staggers from the first to the last while `-1`
     * staggers from the last to the first.
     *
     * @public
     */
    staggerDirection?: number
}

export interface KeyframeOptions {
    ease?: Easing | Easing[]
    times?: number[]
}

export interface Transition
    extends AnimationOrchestrationOptions,
        AnimationPlaybackOptions,
        Omit<SpringOptions, "keyframes">,
        Omit<InertiaOptions, "keyframes">,
        KeyframeOptions {
    /**
     * Delay the animation by this duration (in seconds). Defaults to `0`.
     *
     * @public
     */
    delay?: number

    /**
     * The duration of time already elapsed in the animation. Set to `0` by
     * default.
     */
    elapsed?: number

    driver?: Driver

    /**
     * Type of animation to use.
     *
     * - "tween": Duration-based animation with ease curve
     * - "spring": Physics or duration-based spring animation
     */
    type?: AnimationGeneratorType

    /**
     * The duration of the tween animation. Set to `0.3` by default, 0r `0.8` if animating a series of keyframes.
     *
     * @public
     */
    duration?: number
    autoplay?: boolean
    startTime?: number

    // @deprecated
    from?: any
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

export type StyleTransitions = {
    [K in keyof CSSStyleDeclarationWithTransform]?: Transition
}

export type ValueKeyframe<T extends string | number = string | number> = T

export type UnresolvedValueKeyframe<
    T extends string | number = string | number
> = ValueKeyframe<T> | null

export type ResolvedValueKeyframe = ValueKeyframe | ValueKeyframe[]

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

export type AnimationOptionsWithValueOverrides<V = any> = StyleTransitions &
    SVGPathTransitions &
    SVGTransitions &
    VariableTransitions &
    ValueAnimationTransition<V>

export type DynamicOption<T> = (i: number, total: number) => T

export interface AnimationOptions
    extends Omit<AnimationOptionsWithValueOverrides, "delay"> {
    delay?: number | DynamicOption<number>
}

export interface TransformProperties {
    x?: string | number
    y?: string | number
    z?: string | number
    translateX?: string | number
    translateY?: string | number
    translateZ?: string | number
    rotate?: string | number
    rotateX?: string | number
    rotateY?: string | number
    rotateZ?: string | number
    scale?: string | number
    scaleX?: string | number
    scaleY?: string | number
    scaleZ?: string | number
    skew?: string | number
    skewX?: string | number
    skewY?: string | number
    originX?: string | number
    originY?: string | number
    originZ?: string | number
    perspective?: string | number
    transformPerspective?: string | number
}

export interface SVGPathProperties {
    pathLength?: number
    pathOffset?: number
    pathSpacing?: number
}
