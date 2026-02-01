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
    Transition & At
]

export type DOMSegment = [ElementOrSelector, DOMKeyframesDefinition]

export type DOMSegmentWithTransition = [
    ElementOrSelector,
    DOMKeyframesDefinition,
    DynamicAnimationOptions & At
]

export type ObjectSegment<O extends {} = {}> = [O, ObjectTarget<O>]

export type ObjectSegmentWithTransition<O extends {} = {}> = [
    O,
    ObjectTarget<O>,
    DynamicAnimationOptions & At
]

/**
 * Callback to be invoked at a specific point in the sequence.
 * - `onEnter`: Called when time crosses this point moving forward
 * - `onLeave`: Called when time crosses this point moving backward (for scrubbing)
 */
export interface SequenceCallback {
    onEnter?: VoidFunction
    onLeave?: VoidFunction
}

export type CallbackSegment = [SequenceCallback, At]

export type Segment =
    | ObjectSegment
    | ObjectSegmentWithTransition
    | SequenceLabel
    | SequenceLabelWithTime
    | MotionValueSegment
    | MotionValueSegmentWithTransition
    | DOMSegment
    | DOMSegmentWithTransition
    | CallbackSegment

export type AnimationSequence = Segment[]

export interface SequenceOptions extends AnimationPlaybackOptions {
    delay?: number
    duration?: number
    defaultTransition?: Transition
    reduceMotion?: boolean
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

/**
 * A callback positioned at an absolute time in the sequence
 */
export interface ResolvedSequenceCallback {
    time: number
    onEnter?: VoidFunction
    onLeave?: VoidFunction
}
