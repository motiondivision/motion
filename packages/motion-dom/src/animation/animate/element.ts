import { isNumericalString, isZeroValueString } from "motion-utils"
import { MotionValueState } from "../../effects/MotionValueState"
import {
    addStyleValue,
    readStyleValue,
    StyleSubject,
} from "../../effects/style"
import { frame } from "../../frameloop"
import { measureViewportBox } from "../../projection/utils/measure"
import { positionalKeys } from "../../render/utils/keys-position"
import type { VisualElement } from "../../render/VisualElement"
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

/**
 * The state animate() keeps per DOM element: the motion values bound to
 * it via the style effect, plus what the DOM keyframe resolver needs to
 * read and measure it. Replaces the VisualElement for animate().
 */
export class ElementState implements AnimationElement, Owner {
    KeyframeResolver = DOMKeyframesResolver

    state = new MotionValueState()

    constructor(public current: StyleSubject) {}

    getValue(key: string): MotionValue | undefined
    getValue(key: string, defaultValue: AnyResolvedKeyframe | null): MotionValue
    getValue(
        key: string,
        defaultValue?: AnyResolvedKeyframe | null
    ): MotionValue | undefined {
        let value = this.state.get(key)

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
        return addStyleValue(this.current, this.state, key, value)
    }

    /**
     * Reads a value from the DOM as the origin of an animation. Numeric
     * strings become numbers, a non-animatable value (e.g. "none")
     * becomes an animatable zero in the shape of the target, and a value
     * that can't be read at all is 0, as the VisualElement reports it.
     */
    readValue(key: string, target?: AnyResolvedKeyframe | null) {
        let value: AnyResolvedKeyframe =
            readStyleValue(this.current, key) ?? 0

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
        this.state.flush()
    }

    measureViewportBox() {
        return measureViewportBox(this.current as HTMLElement)
    }

    getProps() {
        return noProps
    }
}

const elementStates = new WeakMap<Element, ElementState>()

export function getElementState(element: StyleSubject): ElementState {
    let state = elementStates.get(element)

    if (!state) {
        state = new ElementState(element)
        elementStates.set(element, state)
    }

    return state
}

/**
 * Hand the values animate() is rendering on `element` to a VisualElement
 * that now owns the element (e.g. created by animateLayout()), so a
 * single renderer drives them alongside its own values.
 */
export function handOffElementState(
    element: Element,
    visualElement: VisualElement
) {
    const state = elementStates.get(element)
    if (!state) return

    const { transformKeys } = state.state
    state.state.release().forEach((value, key) => {
        /**
         * The style effect derives transform (from the bound transform
         * keys) and transformBox itself; a VisualElement builds its own.
         */
        const derived =
            key === "transformBox" ||
            (key === "transform" && transformKeys?.length)

        derived || visualElement.addValue(key, value)
    })

    elementStates.delete(element)
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
 * Animate the styles of a DOM element. Values are bound to the element
 * via the style effect and resolved with the DOM keyframe resolver, so
 * reads are batched, units are converted by measurement and eligible
 * values run on WAAPI.
 */
export function animateElement(
    element: StyleSubject,
    keyframes: ElementKeyframes,
    transition: ElementTransition = {}
): AnimationPlaybackControlsWithThen[] {
    const state = getElementState(element)
    const animations: AnimationPlaybackControlsWithThen[] = []
    const { reduceMotion, velocity } = transition

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
