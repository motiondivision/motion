import { invariant, removeItem } from "motion-utils"
import { AnimateEffect } from "../../effects/utils/create-effect"
import { frame } from "../../frameloop"
import { positionalKeys } from "../../render/utils/keys-position"
import { MotionValue, motionValue } from "../../value"
import { animateMotionValue } from "../interfaces/motion-value"
import { AnimationElement } from "../keyframes/types"
import {
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    UnresolvedValueKeyframe,
    ValueTransition,
} from "../types"

/**
 * Effects registered via `animate.addEffect()`, most recent first.
 */
const effects: AnimateEffect<any>[] = []

export function addEffect(effect: AnimateEffect<any>): void {
    invariant(
        typeof effect.test === "function" && typeof effect.read === "function",
        "Effects passed to animate.addEffect() need test() and read().",
        "effect-missing-test"
    )

    removeEffect(effect)
    effects.unshift(effect)
}

export function removeEffect(effect: AnimateEffect<any>): void {
    removeItem(effects, effect)
}

export function findEffect(subject: unknown): AnimateEffect | undefined {
    return effects.find((effect) => effect.test(subject))
}

export interface EffectKeyframes {
    [key: string]:
        | UnresolvedValueKeyframe
        | UnresolvedValueKeyframe[]
        | Record<string, unknown>
        | undefined
    transition?: Record<string, unknown>
    transitionEnd?: Record<string, AnyResolvedKeyframe>
}

/**
 * Effect subjects can expose any key, so per-key transition overrides
 * are keyed by arbitrary strings.
 */
export type EffectTransition = ValueTransition & {
    reduceMotion?: boolean
    skipAnimations?: boolean
} & Record<string, unknown>

/**
 * Animate each key in `keyframes` on the motion value `getValue` returns
 * for it. `element` is what the keyframe resolver uses to read, render
 * and measure the subject when the effect defers resolution to it.
 */
export function animateValues(
    getValue: (key: string) => MotionValue,
    keyframes: EffectKeyframes,
    transition: EffectTransition = {},
    element?: AnimationElement
): AnimationPlaybackControlsWithThen[] {
    const animations: AnimationPlaybackControlsWithThen[] = []
    const { velocity } = transition
    const reduceMotion = transition.reduceMotion ?? element?.shouldReduceMotion

    for (const key in keyframes) {
        if (key === "transition" || key === "transitionEnd") continue

        const target = keyframes[key]
        if (target === undefined) continue

        const value = getValue(key)

        /**
         * If the value is already at the defined target, skip the animation.
         * We still re-assert the value via frame.update to take precedence
         * over any stale transitionEnd callbacks from previous animations.
         */
        const current = value.get()
        if (
            current !== undefined &&
            !value.isAnimating() &&
            !Array.isArray(target) &&
            target === current &&
            !velocity
        ) {
            frame.update(() => value.set(target))
            continue
        }

        value.start(
            animateMotionValue(
                key,
                value,
                target as any,
                reduceMotion && positionalKeys.has(key)
                    ? { type: false }
                    : transition,
                element
            )
        )

        value.animation &&
            animations.push(
                value.animation as AnimationPlaybackControlsWithThen
            )
    }

    const { transitionEnd } = keyframes
    if (transitionEnd) {
        const applyTransitionEnd = () =>
            frame.update(() => {
                for (const key in transitionEnd) {
                    getValue(key).set(transitionEnd[key])
                }
            })

        animations.length
            ? Promise.all(animations).then(applyTransitionEnd)
            : applyTransitionEnd()
    }

    return animations
}

/**
 * Animate the keys of `subject` via `effect`. Motion values are created on
 * first animation and bound to the subject through the effect for the
 * rest of its life.
 *
 * Without `element`, a new value is seeded synchronously from the first
 * keyframe or `effect.read()`. With it, the value starts undefined and the
 * keyframe resolver reads the subject (batched, with unit conversion by
 * measurement) via `element`.
 */
export function animateEffectSubject<Subject extends object>(
    effect: AnimateEffect<Subject>,
    subject: Subject,
    keyframes: EffectKeyframes,
    transition?: EffectTransition,
    element?: AnimationElement
): AnimationPlaybackControlsWithThen[] {
    return animateValues(
        (key) => {
            let value = effect.get(subject, key)

            if (!value) {
                let initial: AnyResolvedKeyframe | undefined

                if (!element) {
                    const target = keyframes[key] as
                        | UnresolvedValueKeyframe
                        | UnresolvedValueKeyframe[]
                    initial =
                        firstKeyframe(target) ??
                        effect.read(subject, key, target)

                    invariant(
                        initial !== undefined,
                        `"${key}" can't be read from the animated subject. Provide [from, to] keyframes.`,
                        "effect-unreadable-value"
                    )
                }

                value = motionValue(initial, { owner: element })
                effect(subject, { [key]: value })
            }

            return value
        },
        keyframes,
        transition,
        element
    )
}

function firstKeyframe(
    target: UnresolvedValueKeyframe | UnresolvedValueKeyframe[] | undefined
) {
    const first = Array.isArray(target) ? target[0] : undefined
    return first === null ? undefined : first
}
