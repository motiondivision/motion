import { SVGAttributes } from "../render/svg/types"

export interface ProgressTimeline {
    currentTime: null | { value: number }

    cancel?: VoidFunction
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
    state?: AnimationPlayState

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
     * Allows the animation to be awaited.
     */
    then: (onResolve: VoidFunction, onReject?: VoidFunction) => Promise<void>

    /**
     * Attaches a timeline to the animation, for instance the `ScrollTimeline`.
     *
     * This is currently for internal use only.
     */
    attachTimeline?: (
        timeline: ProgressTimeline,
        fallback?: (
            animation:
                | AnimationPlaybackControls
                | AnimationPlaybackControlsWithFinished
        ) => VoidFunction
    ) => VoidFunction

    /**
     * Flattens the animation's easing curve to linear.
     *
     * This is currently for internal use only, and is used by scroll() to
     * ensure an animation is being scrubbed by progress rather than eased time.
     */
    flatten: () => void
}

export type AnimationPlaybackControlsWithFinished = Omit<
    AnimationPlaybackControls,
    "then"
> & { finished: Promise<any> }

export interface AnimationState<V> {
    value: V
    done: boolean
}

export interface KeyframeGenerator<V> {
    calculatedDuration: null | number
    next: (t: number) => AnimationState<V>
    toString: () => string
}

export interface ValueAnimationOptions<V extends string | number = number>
    extends ValueAnimationTransition {
    keyframes: V[]
    name?: string
    from?: V
    isGenerator?: boolean
    allowFlatten?: boolean
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

export interface AnimationPlaybackLifecycles<V> {
    onUpdate?: (latest: V) => void
    onPlay?: () => void
    onComplete?: () => void
    onRepeat?: () => void
    onStop?: () => void
}

export interface ValueAnimationTransition<V = any>
    extends Transition,
        AnimationPlaybackLifecycles<V> {}

export type RepeatType = "loop" | "reverse" | "mirror"

export interface AnimationPlaybackOptions {
    repeat?: number
    repeatType?: RepeatType
    repeatDelay?: number
}

export interface VelocityOptions {
    velocity?: number
    restSpeed?: number
    restDelta?: number
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

export type EasingFunction = (v: number) => number

export type EasingModifier = (easing: EasingFunction) => EasingFunction

export type BezierDefinition = readonly [number, number, number, number]

export type EasingDefinition =
    | BezierDefinition
    | "linear"
    | "easeIn"
    | "easeOut"
    | "easeInOut"
    | "circIn"
    | "circOut"
    | "circInOut"
    | "backIn"
    | "backOut"
    | "backInOut"
    | "anticipate"

/**
 * The easing function to use. Set as one of:
 *
 * - The name of an in-built easing function.
 * - An array of four numbers to define a cubic bezier curve.
 * - An easing function, that accepts and returns a progress value between `0` and `1`.
 *
 * @public
 */
export type Easing = EasingDefinition | EasingFunction

export interface DriverControls {
    start: () => void
    stop: () => void
    now: () => number
}

export type Driver = (update: (timestamp: number) => void) => DriverControls

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

export type ValueKeyframe = string | number

export type UnresolvedValueKeyframe = ValueKeyframe | null

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
