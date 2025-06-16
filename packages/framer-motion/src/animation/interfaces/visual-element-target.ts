import type { TargetAndTransition } from "motion-dom"
import {
    AnimationPlaybackControlsWithThen,
    frame,
    getValueTransition,
    positionalKeys,
} from "motion-dom"
import type { AnimationTypeState } from "../../render/utils/animation-state"
import { setTarget } from "../../render/utils/setters"
import type { VisualElement } from "../../render/VisualElement"
import { addValueToWillChange } from "../../value/use-will-change/add-will-change"
import { getOptimisedAppearId } from "../optimized-appear/get-appear-id"
import { animateMotionValue } from "./motion-value"
import type { VisualElementAnimationOptions } from "./types"

/**
 * Decide whether we should block this animation. Previously, we achieved this
 * just by checking whether the key was listed in protectedKeys, but this
 * posed problems if an animation was triggered by afterChildren and protectedKeys
 * had been set to true in the meantime.
 */
function shouldBlockAnimation(
    { protectedKeys, needsAnimating }: AnimationTypeState,
    key: string
) {
    const shouldBlock =
        protectedKeys.hasOwnProperty(key) && needsAnimating[key] !== true

    needsAnimating[key] = false
    return shouldBlock
}

export function animateTarget(
    visualElement: VisualElement,
    targetAndTransition: TargetAndTransition,
    { delay = 0, transitionOverride, type }: VisualElementAnimationOptions = {}
): AnimationPlaybackControlsWithThen[] {
    let {
        transition = visualElement.getDefaultTransition(),
        transitionEnd,
        ...target
    } = targetAndTransition

    if (transitionOverride) transition = transitionOverride

    const animations: AnimationPlaybackControlsWithThen[] = []

    const animationTypeState =
        type &&
        visualElement.animationState &&
        visualElement.animationState.getState()[type]

    for (const key in target) {
        const value = visualElement.getValue(
            key,
            visualElement.latestValues[key] ?? null
        )
        const valueTarget = target[key as keyof typeof target]

        if (
            valueTarget === undefined ||
            (animationTypeState &&
                shouldBlockAnimation(animationTypeState, key))
        ) {
            continue
        }

        const valueTransition = {
            delay,
            ...getValueTransition(transition || {}, key),
        }

        /**
         * If the value is already at the defined target, skip the animation.
         */
        const currentValue = value.get()
        if (
            currentValue !== undefined &&
            !value.isAnimating &&
            !Array.isArray(valueTarget) &&
            valueTarget === currentValue &&
            !valueTransition.velocity
        ) {
            continue
        }

        /**
         * If this is the first time a value is being animated, check
         * to see if we're handling off from an existing animation.
         */
        let isHandoff = false
        if (window.MotionHandoffAnimation) {
            const appearId = getOptimisedAppearId(visualElement)

            if (appearId) {
                const startTime = window.MotionHandoffAnimation(
                    appearId,
                    key,
                    frame
                )

                if (startTime !== null) {
                    valueTransition.startTime = startTime
                    isHandoff = true
                }
            }
        }

        addValueToWillChange(visualElement, key)

        value.start(
            animateMotionValue(
                key,
                value,
                valueTarget,
                visualElement.shouldReduceMotion && positionalKeys.has(key)
                    ? { type: false }
                    : valueTransition,
                visualElement,
                isHandoff
            )
        )

        const animation = value.animation

        if (animation) {
            animations.push(animation)
        }
    }

    if (transitionEnd) {
        Promise.all(animations).then(() => {
            frame.update(() => {
                transitionEnd && setTarget(visualElement, transitionEnd)
            })
        })
    }

    return animations
}
