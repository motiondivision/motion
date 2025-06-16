import type { MotionValue } from "motion-dom"
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

export type Segment =
    | ObjectSegment
    | ObjectSegmentWithTransition
    | SequenceLabel
    | SequenceLabelWithTime
    | MotionValueSegment
    | MotionValueSegmentWithTransition
    | DOMSegment
    | DOMSegmentWithTransition

export type AnimationSequence = Segment[]

export interface SequenceOptions extends AnimationPlaybackOptions {
    delay?: number
    duration?: number
    defaultTransition?: Transition
}

export interface AbsoluteKeyframe {
    value: string | number | null
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
