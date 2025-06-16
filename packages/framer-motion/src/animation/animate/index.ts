import type {
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    ElementOrSelector,
    MotionValue,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
} from "motion-dom"
import { GroupAnimationWithThen } from "motion-dom"
import {
    AnimationSequence,
    ObjectTarget,
    SequenceOptions,
} from "../sequence/types"
import { animateSequence } from "./sequence"
import { animateSubject } from "./subject"

function isSequence(value: unknown): value is AnimationSequence {
    return Array.isArray(value) && value.some(Array.isArray)
}

/**
 * Creates an animation function that is optionally scoped
 * to a specific element.
 */
export function createScopedAnimate(scope?: AnimationScope) {
    /**
     * Animate a sequence
     */
    function scopedAnimate(
        sequence: AnimationSequence,
        options?: SequenceOptions
    ): AnimationPlaybackControlsWithThen
    /**
     * Animate a string
     */
    function scopedAnimate(
        value: string | MotionValue<string>,
        keyframes: string | UnresolvedValueKeyframe<string>[],
        options?: ValueAnimationTransition<string>
    ): AnimationPlaybackControlsWithThen
    /**
     * Animate a number
     */
    function scopedAnimate(
        value: number | MotionValue<number>,
        keyframes: number | UnresolvedValueKeyframe<number>[],
        options?: ValueAnimationTransition<number>
    ): AnimationPlaybackControlsWithThen
    /**
     * Animate a generic motion value
     */
    function scopedAnimate<V extends string | number>(
        value: V | MotionValue<V>,
        keyframes: V | UnresolvedValueKeyframe<V>[],
        options?: ValueAnimationTransition<V>
    ): AnimationPlaybackControlsWithThen
    /**
     * Animate an Element
     */
    function scopedAnimate(
        element: ElementOrSelector,
        keyframes: DOMKeyframesDefinition,
        options?: DynamicAnimationOptions
    ): AnimationPlaybackControlsWithThen
    /**
     * Animate an object
     */
    function scopedAnimate<O extends {}>(
        object: O | O[],
        keyframes: ObjectTarget<O>,
        options?: DynamicAnimationOptions
    ): AnimationPlaybackControlsWithThen
    /**
     * Implementation
     */
    function scopedAnimate<O extends {}>(
        subjectOrSequence:
            | AnimationSequence
            | MotionValue<number>
            | MotionValue<string>
            | number
            | string
            | ElementOrSelector
            | O
            | O[],
        optionsOrKeyframes?:
            | SequenceOptions
            | number
            | string
            | UnresolvedValueKeyframe<number>[]
            | UnresolvedValueKeyframe<string>[]
            | DOMKeyframesDefinition
            | ObjectTarget<O>,
        options?:
            | ValueAnimationTransition<number>
            | ValueAnimationTransition<string>
            | DynamicAnimationOptions
    ): AnimationPlaybackControlsWithThen {
        let animations: AnimationPlaybackControlsWithThen[] = []

        if (isSequence(subjectOrSequence)) {
            animations = animateSequence(
                subjectOrSequence,
                optionsOrKeyframes as SequenceOptions,
                scope
            )
        } else {
            animations = animateSubject(
                subjectOrSequence as ElementOrSelector,
                optionsOrKeyframes as DOMKeyframesDefinition,
                options as DynamicAnimationOptions,
                scope
            )
        }

        const animation = new GroupAnimationWithThen(animations)

        if (scope) {
            scope.animations.push(animation)
        }

        return animation
    }

    return scopedAnimate
}

export const animate = createScopedAnimate()
