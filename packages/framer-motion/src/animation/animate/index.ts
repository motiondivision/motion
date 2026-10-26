import type {
    AnimationScope,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    ElementOrSelector,
    MotionValue,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
} from "motion-dom"
import { activeScope, addEffect, removeEffect } from "motion-dom"
import {
    AnimationSequence,
    ObjectTarget,
    Segment,
    SequenceOptions,
} from "../sequence/types"
import { Timeline, TimelineOptions } from "../timeline"
import { animateSubject } from "./subject"

function isSequence(value: unknown): value is AnimationSequence {
    return Array.isArray(value) && value.some(Array.isArray)
}

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
     * Animate a sequence
     */
    function scopedAnimate(
        sequence: AnimationSequence,
        options?: Omit<TimelineOptions, "scope">
    ): Timeline
    /**
     * Animate a string
     */
    function scopedAnimate(
        value: string | MotionValue<string>,
        keyframes: string | UnresolvedValueKeyframe<string>[],
        options?: ValueAnimationTransition<string>
    ): Timeline
    /**
     * Animate a number
     */
    function scopedAnimate(
        value: number | MotionValue<number>,
        keyframes: number | UnresolvedValueKeyframe<number>[],
        options?: ValueAnimationTransition<number>
    ): Timeline
    /**
     * Animate a generic motion value
     */
    function scopedAnimate<V extends string | number>(
        value: V | MotionValue<V>,
        keyframes: V | UnresolvedValueKeyframe<V>[],
        options?: ValueAnimationTransition<V>
    ): Timeline
    /**
     * Animate an Element
     */
    function scopedAnimate(
        element: ElementOrSelector,
        keyframes: DOMKeyframesDefinition,
        options?: DynamicAnimationOptions
    ): Timeline
    /**
     * Animate an object
     */
    function scopedAnimate<O extends {}>(
        object: O | O[],
        keyframes: ObjectTarget<O>,
        options?: DynamicAnimationOptions
    ): Timeline
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
            | Omit<TimelineOptions, "scope">
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
    ): Timeline {
        const motionScope = activeScope.current
        const scopeTransition = motionScope?.transition

        const inherited: { reduceMotion?: boolean; skipAnimations?: boolean } =
            {}
        if (reduceMotion !== undefined) inherited.reduceMotion = reduceMotion
        if (skipAnimations !== undefined)
            inherited.skipAnimations = skipAnimations

        let timeline: Timeline

        if (isSequence(subjectOrSequence)) {
            const sequenceOptions = {
                ...inherited,
                ...(optionsOrKeyframes as SequenceOptions),
                scope,
            }
            if (scopeTransition) {
                sequenceOptions.defaultTransition = {
                    ...scopeTransition,
                    ...sequenceOptions.defaultTransition,
                } as SequenceOptions["defaultTransition"]
            }
            timeline = new Timeline(subjectOrSequence, sequenceOptions)
        } else {
            // Extract top-level onComplete so it doesn't get applied per-value
            const { onComplete, ...rest } = options || {}
            const transition = {
                ...inherited,
                ...scopeTransition,
                ...rest,
            } as DynamicAnimationOptions

            /**
             * Play the animations directly, and only compile them as a
             * sequence if the timeline is changed. Values animated from a
             * number are animated via their onUpdate callback instead.
             */
            const { onUpdate } = rest as ValueAnimationTransition
            const segment = (
                typeof subjectOrSequence === "number" ||
                (typeof subjectOrSequence === "string" &&
                    (typeof optionsOrKeyframes === "string" ||
                        Array.isArray(optionsOrKeyframes)))
                    ? [
                          onUpdate || (() => {}),
                          Array.isArray(optionsOrKeyframes)
                              ? optionsOrKeyframes
                              : [subjectOrSequence, optionsOrKeyframes],
                          { ...transition, onUpdate: undefined },
                      ]
                    : [subjectOrSequence, optionsOrKeyframes, transition]
            ) as Segment

            timeline = new Timeline(
                [segment],
                { ...inherited, onComplete, scope } as SequenceOptions,
                animateSubject(
                    subjectOrSequence as ElementOrSelector,
                    optionsOrKeyframes as DOMKeyframesDefinition,
                    transition,
                    scope
                )
            )
        }

        return timeline
    }

    return scopedAnimate
}

export const animate = /* @__PURE__ */ Object.assign(
    /* @__PURE__ */ createScopedAnimate(),
    {
        /**
         * Register an effect so `animate()` can animate the subjects it
         * claims, for instance `animate.addEffect(threeEffect)`. The most
         * recently added effect is tested first. DOM elements are always
         * animated directly.
         */
        addEffect,
        removeEffect,
    }
)
