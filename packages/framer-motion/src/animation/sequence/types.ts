import type { AnyResolvedKeyframe, MotionValue } from "motion-dom"
import {
    AnimationPlaybackOptions,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    ElementOrSelector,
    Transition,
    UnresolvedValueKeyframe,
} from "motion-dom"
import { Easing } from "motion-utils"

/**
 * Lifecycle callbacks are not supported on individual sequence segments
 * because segments are consolidated into a single animation per subject.
 * Use sequence-level options (e.g. SequenceOptions.onComplete) instead.
 */
type LifecycleCallbacks =
    | "onUpdate"
    | "onPlay"
    | "onComplete"
    | "onRepeat"
    | "onStop"

/**
 * Distributive Omit preserves union branches (unlike plain Omit).
 */
type DistributiveOmit<T, K extends string> = T extends any
    ? Omit<T, K>
    : never

export type SegmentTransitionOptions = DistributiveOmit<
    DynamicAnimationOptions,
    LifecycleCallbacks
> &
    At

export type SegmentValueTransitionOptions = DistributiveOmit<
    Transition,
    LifecycleCallbacks
> &
    At

export type ObjectTarget<O> = {
    [K in keyof O]?: O[K] | UnresolvedValueKeyframe[]
}

export type SequenceTime =
    | number
    | "<"
    | `+${number}`
    | `-${number}`
    | `${string}`

export type SequenceLabel = string

export interface SequenceLabelWithTime {
    name: SequenceLabel
    at: SequenceTime
}

export interface At {
    at?: SequenceTime
}

export type MotionValueSegment = [
    MotionValue,
    UnresolvedValueKeyframe | UnresolvedValueKeyframe[]
]

export type MotionValueSegmentWithTransition = [
    MotionValue,
    UnresolvedValueKeyframe | UnresolvedValueKeyframe[],
    SegmentValueTransitionOptions
]

export type DOMSegment = [ElementOrSelector, DOMKeyframesDefinition]

export type DOMSegmentWithTransition = [
    ElementOrSelector,
    DOMKeyframesDefinition,
    SegmentTransitionOptions
]

export type ObjectSegment<O extends {} = {}> = [O, ObjectTarget<O>]

export type ObjectSegmentWithTransition<O extends {} = {}> = [
    O,
    ObjectTarget<O>,
    SegmentTransitionOptions
]

export type SequenceProgressCallback = (value: any) => void

export type FunctionSegment =
    | [SequenceProgressCallback]
    | [SequenceProgressCallback, SegmentTransitionOptions]
    | [
          SequenceProgressCallback,
          UnresolvedValueKeyframe | UnresolvedValueKeyframe[],
          SegmentTransitionOptions
      ]

export type Segment =
    | ObjectSegment
    | ObjectSegmentWithTransition
    | SequenceLabel
    | SequenceLabelWithTime
    | MotionValueSegment
    | MotionValueSegmentWithTransition
    | DOMSegment
    | DOMSegmentWithTransition
    | FunctionSegment

export type AnimationSequence = Segment[]

export interface SequenceOptions extends AnimationPlaybackOptions {
    delay?: number
    duration?: number
    defaultTransition?: Transition
    reduceMotion?: boolean
    onComplete?: () => void
}

export interface AbsoluteKeyframe {
    value: AnyResolvedKeyframe | null
    at: number
    easing?: Easing
}

export type ValueSequence = AbsoluteKeyframe[]

export interface SequenceMap {
    [key: string]: ValueSequence
}

export type ResolvedAnimationDefinition = {
    keyframes: { [key: string]: UnresolvedValueKeyframe[] }
    transition: { [key: string]: Transition }
}

export type ResolvedAnimationDefinitions = Map<
    Element | MotionValue,
    ResolvedAnimationDefinition
>

