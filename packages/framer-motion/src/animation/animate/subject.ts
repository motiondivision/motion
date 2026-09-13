import {
    animateEffectSubject,
    animateElement,
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    AnyResolvedKeyframe,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    EffectKeyframes,
    EffectTransition,
    ElementKeyframes,
    ElementOrSelector,
    ElementTransition,
    findEffect,
    isMotionValue,
    MotionValue,
    propEffect,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
    visualElementStore,
} from "motion-dom"
import { invariant } from "motion-utils"
import { ObjectTarget } from "../sequence/types"
import { isDOMKeyframes } from "../utils/is-dom-keyframes"
import { resolveSubjects } from "./resolve-subjects"
import { animateSingleValue } from "motion-dom"

export type AnimationSubject = Element | MotionValue<any> | any

function isSingleValue(
    subject: unknown,
    keyframes: unknown
): subject is MotionValue | AnyResolvedKeyframe {
    return (
        isMotionValue(subject) ||
        typeof subject === "number" ||
        (typeof subject === "string" && !isDOMKeyframes(keyframes))
    )
}

/**
 * Animate a string
 */
export function animateSubject(
    value: string | MotionValue<string>,
    keyframes: string | UnresolvedValueKeyframe<string>[],
    options?: ValueAnimationTransition<string>
): AnimationPlaybackControlsWithThen[]
/**
 * Animate a number
 */
export function animateSubject(
    value: number | MotionValue<number>,
    keyframes: number | UnresolvedValueKeyframe<number>[],
    options?: ValueAnimationTransition<number>
): AnimationPlaybackControlsWithThen[]
/**
 * Animate a Element
 */
export function animateSubject(
    element: ElementOrSelector,
    keyframes: DOMKeyframesDefinition,
    options?: DynamicAnimationOptions,
    scope?: AnimationScope
): AnimationPlaybackControlsWithThen[]
/**
 * Animate a object
 */
export function animateSubject<O extends Object>(
    object: O | O[],
    keyframes: ObjectTarget<O>,
    options?: DynamicAnimationOptions
): AnimationPlaybackControlsWithThen[]
/**
 * Implementation
 */
export function animateSubject<O extends Object>(
    subject:
        | MotionValue<number>
        | MotionValue<string>
        | number
        | string
        | ElementOrSelector
        | O
        | O[],
    keyframes:
        | number
        | string
        | UnresolvedValueKeyframe<number>[]
        | UnresolvedValueKeyframe<string>[]
        | DOMKeyframesDefinition
        | ObjectTarget<O>,
    options?:
        | ValueAnimationTransition<number>
        | ValueAnimationTransition<string>
        | DynamicAnimationOptions,
    scope?: AnimationScope
): AnimationPlaybackControlsWithThen[] {
    const animations: AnimationPlaybackControlsWithThen[] = []

    if (isSingleValue(subject, keyframes)) {
        animations.push(
            animateSingleValue(
                subject,
                isDOMKeyframes(keyframes)
                    ? (keyframes as any).default || keyframes
                    : keyframes,
                options ? (options as any).default || options : options
            )
        )
    } else {
        // Gracefully handle null/undefined subjects (e.g., from querySelector returning null)
        if (subject == null) {
            return animations
        }

        const subjects = resolveSubjects(
            subject,
            keyframes as DOMKeyframesDefinition,
            scope
        )

        const numSubjects = subjects.length

        invariant(
            Boolean(numSubjects),
            "No valid elements provided.",
            "no-valid-elements"
        )

        for (let i = 0; i < numSubjects; i++) {
            const thisSubject = subjects[i]
            const transition = { ...options }

            /**
             * Resolve stagger function if provided.
             */
            if (
                "delay" in transition &&
                typeof transition.delay === "function"
            ) {
                transition.delay = transition.delay(i, numSubjects)
            }

            if (thisSubject instanceof Element) {
                /**
                 * An element already owned by a VisualElement (a <motion.*>
                 * component or animateLayout()) animates its values so they
                 * share one renderer. Anything else is driven through
                 * styleEffect (or svgEffect) and the DOM keyframe resolver,
                 * without creating a VisualElement.
                 */
                animations.push(
                    ...animateElement(
                        thisSubject as HTMLElement | SVGElement,
                        keyframes as ElementKeyframes,
                        transition as ElementTransition,
                        visualElementStore.get(thisSubject)
                    )
                )
            } else {
                /**
                 * Registered effects (animate.addEffect) claim non-DOM
                 * subjects before we fall back to writing plain properties.
                 */
                animations.push(
                    ...animateEffectSubject(
                        findEffect(thisSubject) ?? propEffect,
                        thisSubject as object,
                        keyframes as EffectKeyframes,
                        transition as EffectTransition
                    )
                )
            }
        }
    }

    return animations
}
