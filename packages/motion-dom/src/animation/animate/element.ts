import {
    isStyleSubject,
    readStyleValue,
    styleSubjectEffect,
    StyleSubject,
} from "../../effects/style"
import { readSVGValue, svgSubjectEffect } from "../../effects/svg"
import type { AnimateEffect } from "../../effects/utils/create-effect"
import { measureViewportBox } from "../../projection/utils/measure"
import type { VisualElement } from "../../render/VisualElement"
import { isSVGElement } from "../../utils/is-svg-element"
import { activeScope } from "../../scope/active"
import { MotionValue, Owner } from "../../value"
import { transformGroups } from "../waapi/transforms/groups"
import { DOMKeyframesResolver } from "../keyframes/DOMKeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import { AnimationPlaybackControlsWithThen } from "../types"
import {
    MultiValueRef,
    animateEffectSubject,
    animateValues,
    EffectKeyframes,
    EffectTransition,
} from "./effects"

const noProps = {}

/**
 * The hooks `animate()` resolves elements through: whether an effect
 * claims a subject, and the subject's current value as an animation's
 * origin. They're attached here, which only `animate()` loads, so a
 * `styleEffect()` or `svgEffect()` import alone doesn't bundle the
 * computed-style and transform-matrix readers. The selector effects'
 * `test` and `read` forward to these.
 */
Object.assign(styleSubjectEffect, {
    test: isStyleSubject,
    read: readStyleValue,
})
Object.assign(svgSubjectEffect, { test: isSVGElement, read: readSVGValue })

type ElementEffect = AnimateEffect<StyleSubject>

const getElementEffect = (element: Element) =>
    (isSVGElement(element)
        ? svgSubjectEffect
        : styleSubjectEffect) as ElementEffect

/**
 * Presents an effect bound to a DOM element in the shape the DOM keyframe
 * resolver and WAAPI expect, which is that of a VisualElement. Holds no
 * state: everything delegates to the effect. Goes once the resolver takes
 * an effect and subject directly.
 */
class EffectSubject implements AnimationElement, Owner {
    KeyframeResolver = DOMKeyframesResolver

    constructor(private effect: ElementEffect, public current: StyleSubject) {}

    getValue(key: string) {
        return this.effect.get(this.current, key)
    }

    readValue(key: string, target?: unknown) {
        return this.effect.read(this.current, key, target as any)
    }

    render() {
        this.effect.flush(this.current)
    }

    measureViewportBox() {
        return measureViewportBox(this.current as HTMLElement)
    }

    getProps() {
        return noProps
    }
}

/**
 * Animate a DOM element's styles. HTML elements are bound through
 * styleEffect, SVG through svgEffect, and both are resolved with the DOM
 * keyframe resolver so reads are batched, units are converted by
 * measurement and eligible values run on WAAPI.
 *
 * Pass the element's VisualElement (a <motion.*> component or an
 * animateLayout() node) to animate its values instead, so the two keep
 * sharing values and a renderer.
 */
export function animateElement(
    element: StyleSubject,
    keyframes: EffectKeyframes,
    transition?: EffectTransition,
    visualElement?: VisualElement,
    animationRef?: MultiValueRef
): AnimationPlaybackControlsWithThen[] {
    activeScope.current?.track(element)

    if (visualElement) {
        return animateValues(
            (key) => visualElement.getValue(key, null),
            keyframes,
            transition,
            visualElement,
            animationRef
        )
    }

    const effect = getElementEffect(element)

    return animateEffectSubject(
        effect,
        element,
        keyframes,
        transition,
        new EffectSubject(effect, element),
        animationRef
    )
}

/**
 * Detach the values styleEffect/svgEffect bound to `element`, so the
 * next animation reads its starting values from the DOM again.
 */
export const releaseElement = (element: Element) =>
    getElementEffect(element)
        .state(element as StyleSubject)
        ?.release()

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

    /**
     * A transform group reads values through the effect state, which is
     * about to be emptied. Hand its animations to the main thread (writing
     * their current transform) and detach it, so animations the
     * VisualElement starts form a new group that reads from it.
     */
    const group = transformGroups.get(element)
    if (group) {
        group.demote()
        transformGroups.delete(element)
    }

    const { transformKeys } = state
    state.release().forEach((value: MotionValue, key: string) => {
        /**
         * The style effect derives transform (from the bound transform
         * keys) and transformBox itself; a VisualElement builds its own.
         */
        const derived =
            key === "transformBox" ||
            (key === "transform" && transformKeys?.length)

        if (!derived) {
            value.owner = visualElement
            visualElement.addValue(key, value)
        }
    })
}
