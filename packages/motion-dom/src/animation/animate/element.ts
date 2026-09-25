import { styleSubjectEffect, StyleSubject } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import { measureViewportBox } from "../../projection/utils/measure"
import type { VisualElement } from "../../render/VisualElement"
import { isSVGElement } from "../../utils/is-svg-element"
import { MotionValue, Owner } from "../../value"
import { DOMKeyframesResolver } from "../keyframes/DOMKeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import { AnimationPlaybackControlsWithThen } from "../types"
import {
    animateEffectSubject,
    animateValues,
    EffectKeyframes,
    EffectTransition,
} from "./effects"

const noProps = {}

type ElementEffect = typeof styleSubjectEffect

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

    suspend(key: string) {
        this.effect.state(this.current)?.suspend(key)
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
    visualElement?: VisualElement
): AnimationPlaybackControlsWithThen[] {
    if (visualElement) {
        return animateValues(
            (key) => visualElement.getValue(key, null),
            keyframes,
            transition,
            visualElement
        )
    }

    const effect = getElementEffect(element)

    return animateEffectSubject(
        effect,
        element,
        keyframes,
        transition,
        new EffectSubject(effect, element)
    )
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

    const { transformKeys, suspended } = state
    state.release().forEach((value: MotionValue, key: string) => {
        /**
         * The style effect derives transform (from the bound transform
         * keys) and transformBox itself; a VisualElement builds its own.
         */
        const derived =
            key === "transformBox" ||
            (key === "transform" && transformKeys?.length)

        if (derived) return

        /**
         * The VisualElement renders the value from here, so it also takes
         * over suspending it.
         */
        value.owner = visualElement
        visualElement.addValue(key, value)
        suspended?.has(key) && visualElement.suspend(key)
    })
}
