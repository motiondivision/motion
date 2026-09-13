import { isNumericalString, isZeroValueString } from "motion-utils"
import { styleSubjectEffect, StyleSubject } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import { frame } from "../../frameloop"
import { measureViewportBox } from "../../projection/utils/measure"
import { positionalKeys } from "../../render/utils/keys-position"
import type { VisualElement } from "../../render/VisualElement"
import { isSVGElement } from "../../utils/is-svg-element"
import { MotionValue, motionValue, Owner } from "../../value"
import { complex } from "../../value/types/complex"
import { getAnimatableNone } from "../../value/types/utils/animatable-none"
import { animateMotionValue } from "../interfaces/motion-value"
import { DOMKeyframesResolver } from "../keyframes/DOMKeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import {
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    DOMKeyframesDefinition,
    UnresolvedValueKeyframe,
    ValueTransition,
} from "../types"

const noProps = {}

type ElementEffect = typeof styleSubjectEffect

const getElementEffect = (element: Element) =>
    (isSVGElement(element)
        ? svgSubjectEffect
        : styleSubjectEffect) as ElementEffect

/**
 * animate()'s view of a DOM element: what the DOM keyframe resolver needs
 * to read, render and measure it, on top of the motion values bound
 * through styleEffect (or svgEffect, which also writes attributes and path
 * drawing). It holds no state of its own - the effect's per-element
 * MotionValueState is the single store, so `styleEffect(el, { x })` and
 * `animate(el, { x })` drive the same value and the same render. Replaces
 * the VisualElement for animate().
 */
export class ElementState implements AnimationElement, Owner {
    KeyframeResolver = DOMKeyframesResolver

    private effect: ElementEffect

    constructor(public current: StyleSubject) {
        this.effect = getElementEffect(current)
    }

    getValue(key: string): MotionValue | undefined
    getValue(key: string, defaultValue: AnyResolvedKeyframe | null): MotionValue
    getValue(
        key: string,
        defaultValue?: AnyResolvedKeyframe | null
    ): MotionValue | undefined {
        let value = this.effect.get(this.current, key)

        if (!value && defaultValue !== undefined) {
            value = motionValue(
                defaultValue === null ? undefined : defaultValue,
                { owner: this }
            )
            this.addValue(key, value)
        }

        return value
    }

    addValue(key: string, value: MotionValue) {
        return this.effect(this.current, { [key]: value })
    }

    /**
     * Reads a value from the DOM as the origin of an animation. Numeric
     * strings become numbers, a non-animatable value (e.g. "none")
     * becomes an animatable zero in the shape of the target, and a value
     * that can't be read at all is 0, as the VisualElement reports it.
     */
    readValue(key: string, target?: AnyResolvedKeyframe | null) {
        let value: AnyResolvedKeyframe =
            this.effect.read!(this.current, key) ?? 0

        if (typeof value === "string") {
            if (isNumericalString(value) || isZeroValueString(value)) {
                value = parseFloat(value)
            } else if (!complex.test(value) && complex.test(target)) {
                value = getAnimatableNone(key, target as string)
            }
        }

        return value
    }

    /**
     * Writes pending values to the element, so the resolver can measure
     * the element with the target keyframe applied.
     */
    render() {
        this.effect.state(this.current)?.flush()
    }

    measureViewportBox() {
        return measureViewportBox(this.current as HTMLElement)
    }

    getProps() {
        return noProps
    }
}

/**
 * Hand the values styleEffect/svgEffect are rendering on `element`,
 * whether bound by animate() or directly, to a VisualElement that now
 * owns the element (e.g. created by animateLayout()), so a single
 * renderer drives them alongside its own values.
 */
export function handOffElementState(
    element: Element,
    visualElement: VisualElement
) {
    const state = getElementEffect(element).state(element as StyleSubject)
    if (!state) return

    const { transformKeys } = state
    state.release().forEach((value, key) => {
        /**
         * The style effect derives transform (from the bound transform
         * keys) and transformBox itself; a VisualElement builds its own.
         */
        const derived =
            key === "transformBox" ||
            (key === "transform" && transformKeys?.length)

        derived || visualElement.addValue(key, value)
    })
}

export type ElementKeyframes = DOMKeyframesDefinition & {
    transition?: unknown
    transitionEnd?: Record<string, AnyResolvedKeyframe>
}

/**
 * Per-value overrides are keyed by style name, plus the options a scoped
 * animate() inherits.
 */
export type ElementTransition = ValueTransition & {
    reduceMotion?: boolean
    skipAnimations?: boolean
} & Record<string, unknown>

/**
 * Animate a DOM element's styles. HTML elements are bound through
 * styleEffect, SVG through svgEffect, and both are resolved with the
 * DOM keyframe resolver so reads are batched, units are converted by
 * measurement and eligible values run on WAAPI.
 *
 * `state` is what owns and renders the element's values: its ElementState
 * by default, or the VisualElement of a <motion.*> component or
 * animateLayout() node so the two keep sharing values and a renderer.
 */
export function animateElement(
    element: StyleSubject,
    keyframes: ElementKeyframes,
    transition: ElementTransition = {},
    state: AnimationElement = new ElementState(element)
): AnimationPlaybackControlsWithThen[] {
    const animations: AnimationPlaybackControlsWithThen[] = []
    const { velocity } = transition
    const reduceMotion = transition.reduceMotion ?? state.shouldReduceMotion

    for (const key in keyframes) {
        if (key === "transition" || key === "transitionEnd") continue

        const target = keyframes[key as keyof DOMKeyframesDefinition] as
            | UnresolvedValueKeyframe
            | UnresolvedValueKeyframe[]
            | undefined

        if (target === undefined) continue

        const value = state.getValue(key, null)

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
                state
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
                    state.getValue(key, null).set(transitionEnd[key])
                }
            })

        animations.length
            ? Promise.all(animations).then(applyTransitionEnd)
            : applyTransitionEnd()
    }

    return animations
}
