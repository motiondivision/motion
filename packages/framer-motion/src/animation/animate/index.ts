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
import { addEffect, GroupAnimationWithThen, removeEffect } from "motion-dom"
import { invariant, removeItem } from "motion-utils"
import {
    AnimationSequence,
    ObjectTarget,
    SequenceOptions,
} from "../sequence/types"
import { animateSubject } from "./subject"

interface ScopedAnimateOptions {
    scope?: AnimationScope
    reduceMotion?: boolean
    skipAnimations?: boolean
}

/**
 * Creates an animation function that is optionally scoped
 * to a specific element.
 */
export function createScopedAnimate(options: ScopedAnimateOptions = {}) {
    const { scope, reduceMotion, skipAnimations } = options
    /**
     * @deprecated Sequences have moved to `timeline()`:
     * `timeline([...segments], options)`.
     */
    function scopedAnimate(
        sequence: AnimationSequence,
        options?: SequenceOptions
    ): never
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
        subject:
            | AnimationSequence
            | MotionValue<number>
            | MotionValue<string>
            | number
            | string
            | ElementOrSelector
            | O
            | O[],
        keyframes?:
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
        invariant(
            !(Array.isArray(subject) && subject.some(Array.isArray)),
            "Sequences have moved from animate() to timeline(): timeline([...segments], options)",
            "animate-sequence"
        )

        const inherited: { reduceMotion?: boolean; skipAnimations?: boolean } =
            {}
        if (reduceMotion !== undefined) inherited.reduceMotion = reduceMotion
        if (skipAnimations !== undefined)
            inherited.skipAnimations = skipAnimations

        // Extract top-level onComplete so it doesn't get applied per-value
        const { onComplete, ...rest } = options || {}

        const animation = new GroupAnimationWithThen(
            animateSubject(
                subject as ElementOrSelector,
                keyframes as DOMKeyframesDefinition,
                { ...inherited, ...rest } as DynamicAnimationOptions,
                scope
            )
        )

        if (typeof onComplete === "function") {
            animation.finished.then(onComplete as VoidFunction)
        }

        if (scope) {
            scope.animations.push(animation)
            animation.finished.then(() => {
                removeItem(scope.animations, animation)
            })
        }

        return animation
    }

    return scopedAnimate
}

export const animate = Object.assign(createScopedAnimate(), {
    /**
     * Register an effect so `animate()` can animate the subjects it
     * claims, for instance `animate.addEffect(threeEffect)`. The most
     * recently added effect is tested first. DOM elements are always
     * animated directly.
     */
    addEffect,
    removeEffect,
})
