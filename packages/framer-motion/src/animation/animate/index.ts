import {
    AnimationPlaybackControls,
    AnimationScope,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    ElementOrSelector,
    GroupPlaybackControls,
    ValueAnimationTransition,
} from "motion-dom"
import { GenericKeyframesTarget } from "../../types"
import type { MotionValue } from "../../value"
import {
    AnimationSequence,
    ObjectTarget,
    SequenceOptions,
} from "../sequence/types"
import { animateSequence } from "./sequence"
import { animateSubject } from "./subject"

function isSequence(value: unknown): value is AnimationSequence {
    return Array.isArray(value) && Array.isArray(value[0])
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
    ): AnimationPlaybackControls
    /**
     * Animate a string
     */
    function scopedAnimate(
        value: string | MotionValue<string>,
        keyframes: string | GenericKeyframesTarget<string>,
        options?: ValueAnimationTransition<string>
    ): AnimationPlaybackControls
    /**
     * Animate a number
     */
    function scopedAnimate(
        value: number | MotionValue<number>,
        keyframes: number | GenericKeyframesTarget<number>,
        options?: ValueAnimationTransition<number>
    ): AnimationPlaybackControls
    /**
     * Animate a generic motion value
     */
    function scopedAnimate<V>(
        value: V | MotionValue<V>,
        keyframes: V | GenericKeyframesTarget<V>,
        options?: ValueAnimationTransition<V>
    ): AnimationPlaybackControls
    /**
     * Animate an Element
     */
    function scopedAnimate(
        element: ElementOrSelector,
        keyframes: DOMKeyframesDefinition,
        options?: DynamicAnimationOptions
    ): AnimationPlaybackControls
    /**
     * Animate an object
     */
    function scopedAnimate<O extends {}>(
        object: O | O[],
        keyframes: ObjectTarget<O>,
        options?: DynamicAnimationOptions
    ): AnimationPlaybackControls
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
            | GenericKeyframesTarget<number>
            | GenericKeyframesTarget<string>
            | DOMKeyframesDefinition
            | ObjectTarget<O>,
        options?:
            | ValueAnimationTransition<number>
            | ValueAnimationTransition<string>
            | DynamicAnimationOptions
    ): AnimationPlaybackControls {
        let animations: AnimationPlaybackControls[] = []

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

        const animation = new GroupPlaybackControls(animations)

        if (scope) {
            scope.animations.push(animation)
        }

        return animation
    }

    return scopedAnimate
}

export const animate = createScopedAnimate()
