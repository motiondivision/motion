import { invariant, removeItem } from "motion-utils"
import { AnimateEffect } from "../../effects/utils/create-effect"
import { motionValue } from "../../value"
import { animateMotionValue } from "../interfaces/motion-value"
import {
    AnimationPlaybackControlsWithThen,
    UnresolvedValueKeyframe,
    ValueAnimationTransition,
} from "../types"
import { getValueTransition } from "../utils/get-value-transition"

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

export type EffectKeyframes = Record<
    string,
    UnresolvedValueKeyframe | UnresolvedValueKeyframe[]
>

/**
 * Effect subjects can expose any key, so per-key transition overrides
 * are keyed by arbitrary strings.
 */
export type EffectTransition = ValueAnimationTransition &
    Record<string, unknown>

/**
 * Animate the keys of `subject` via `effect`. Motion values are created on
 * first animation, seeded from `effect.read()` or the first keyframe, and
 * then bound to the subject via the effect for the rest of its life.
 */
export function animateEffectSubject<Subject extends object>(
    effect: AnimateEffect<Subject>,
    subject: Subject,
    keyframes: EffectKeyframes,
    transition: EffectTransition = {}
): AnimationPlaybackControlsWithThen[] {
    const animations: AnimationPlaybackControlsWithThen[] = []

    for (const key in keyframes) {
        const target = keyframes[key]
        let value = effect.get(subject, key)

        if (!value) {
            const initial =
                effect.read(subject, key, target) ?? firstKeyframe(target)

            invariant(
                initial !== undefined,
                `"${key}" can't be read from the animated subject. Provide [from, to] keyframes.`,
                "effect-unreadable-value"
            )

            value = motionValue(initial)
            effect(subject, { [key]: value })
        }

        value.start(
            animateMotionValue(
                key,
                value,
                target as any,
                getValueTransition(transition, key)
            )
        )

        value.animation && animations.push(value.animation)
    }

    return animations
}

function firstKeyframe(
    target: UnresolvedValueKeyframe | UnresolvedValueKeyframe[]
) {
    const first = Array.isArray(target) ? target[0] : undefined
    return first === null ? undefined : first
}
