import {
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    ElementOrSelector,
    MotionValue,
    TargetAndTransition,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
    isMotionValue,
} from "motion-dom"
import { invariant } from "motion-utils"
import { visualElementStore } from "../../render/store"
import { animateTarget } from "../interfaces/visual-element-target"
import { ObjectTarget } from "../sequence/types"
import {
    createDOMVisualElement,
    createObjectVisualElement,
} from "../utils/create-visual-element"
import { isDOMKeyframes } from "../utils/is-dom-keyframes"
import { resolveSubjects } from "./resolve-subjects"
import { animateSingleValue } from "./single-value"

export type AnimationSubject = Element | MotionValue<any> | any

function isSingleValue(
    subject: unknown,
    keyframes: unknown
): subject is MotionValue | string | number {
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
        const subjects = resolveSubjects(
            subject,
            keyframes as DOMKeyframesDefinition,
            scope
        )

        const numSubjects = subjects.length

        invariant(Boolean(numSubjects), "No valid elements provided.")

        for (let i = 0; i < numSubjects; i++) {
            const thisSubject = subjects[i]

            const createVisualElement =
                thisSubject instanceof Element
                    ? createDOMVisualElement
                    : createObjectVisualElement

            if (!visualElementStore.has(thisSubject)) {
                createVisualElement(thisSubject as any)
            }

            const visualElement = visualElementStore.get(thisSubject)!
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

            animations.push(
                ...animateTarget(
                    visualElement,
                    { ...(keyframes as {}), transition } as TargetAndTransition,
                    {}
                )
            )
        }
    }

    return animations
}
