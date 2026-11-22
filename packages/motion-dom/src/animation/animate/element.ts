import {
    isStyleSubject,
    readStyleValue,
    styleSubjectEffect,
    StyleSubject,
} from "../../effects/style"
import { readSVGValue, svgSubjectEffect } from "../../effects/svg"
import type { AnimateEffect } from "../../effects/utils/create-effect"
import { releaseNode, type MotionNode } from "../../node/MotionNode"
import { measureViewportBox } from "../../projection/utils/measure-viewport-box"
import { nodeStore } from "../../render/store"
import { isSVGElement } from "../../utils/is-svg-element"
import { activeScope } from "../../scope/active"
import { transformGroups } from "../waapi/transforms/groups"
import { enableAcceleration } from "../waapi/transforms/enable"
import { DOMKeyframesResolver } from "../keyframes/DOMKeyframesResolver"
import { AnimationPlaybackControlsWithThen } from "../types"
import type { MotionValue } from "../../value"
import {
    MultiValueRef,
    animateValues,
    EffectKeyframes,
    EffectTransition,
} from "./effects"

type ElementEffect = AnimateEffect<StyleSubject>

const elementEffect = (element: StyleSubject) =>
    (isSVGElement(element)
        ? svgSubjectEffect
        : styleSubjectEffect) as ElementEffect

function measureNode(this: MotionNode<HTMLElement>) {
    return measureViewportBox(this.current!)
}

/**
 * The node that owns a DOM element: its motion component's, or the one
 * made by whichever of animate(), styleEffect(), svgEffect() or a
 * gesture reached the element first.
 *
 * Animating needs the node to resolve keyframes against the DOM, so
 * reads are batched, units are converted by measurement and eligible
 * values run on WAAPI. A node made by styleEffect() alone doesn't
 * bundle that, so it's added here.
 */
export function getElementNode(element: StyleSubject): MotionNode {
    enableAcceleration()

    const node = nodeStore.get(element) || elementEffect(element).node(element)

    /**
     * A node made by styleEffect() or svgEffect() alone has no way to
     * read the element. One an effect made reads as that effect does.
     */
    if (!node.KeyframeResolver) {
        node.KeyframeResolver = DOMKeyframesResolver
        node.measureViewportBox = measureNode
        node.read ||= (
            isSVGElement(element) ? readSVGValue : readStyleValue
        ) as MotionNode["read"]
    }

    return node
}

/**
 * Animate a DOM element's styles, on the values of the node that owns it.
 */
export function animateElement(
    element: StyleSubject,
    keyframes: EffectKeyframes,
    transition?: EffectTransition,
    node: MotionNode = getElementNode(element),
    animationRef?: MultiValueRef
): AnimationPlaybackControlsWithThen[] {
    activeScope.current?.track(element)

    return animateValues(
        (key) => node.getValue(key, null),
        keyframes,
        transition,
        node,
        animationRef
    )
}

/**
 * Detach the values bound to `element` by animate(), styleEffect() or
 * svgEffect(), so the next animation reads its starting values from the
 * DOM again. A motion component keeps its values, as does an element
 * that has a projection node.
 */
export const releaseElement = (element: Element) => {
    const node = nodeStore.get(element)
    node && !(node as any).scheduleRender && releaseNode(node)
}

/**
 * Hand the values a node is writing to `element` to a node that now
 * owns the element (e.g. a VisualElement created by animateLayout()),
 * so one node writes them alongside its own.
 */
export function adoptElement(element: Element, to: MotionNode) {
    const from = nodeStore.get(element)

    if (from && from !== to) {
        /**
         * A transform group reads values through the node that is about
         * to be emptied. Hand its animations to the main thread (writing
         * their current transform) and detach it, so animations the new
         * owner starts form a new group that reads from it.
         */
        const group = transformGroups.get(element)
        if (group) {
            group.demote()
            transformGroups.delete(element)
        }

        releaseNode(from).forEach((value, key) => {
            value.owner = to
            to.addValue(key, value)
        })
    }

    nodeStore.set(element, to)
}

/**
 * Made in a pure call, so a bundle that never uses domEffect drops it and
 * the readers it attaches. `test` and `read` are also attached to the
 * style and SVG effects, which `styleEffect` and `svgEffect` forward to.
 */
const createDOMEffect = (): ElementEffect => {
    Object.assign(styleSubjectEffect, {
        test: isStyleSubject,
        read: readStyleValue,
    })
    Object.assign(svgSubjectEffect, { test: isSVGElement, read: readSVGValue })

    return Object.assign(
        (element: StyleSubject, values: Record<string, MotionValue>) =>
            elementEffect(element)(element, values),
        {
            first: true,
            test: isStyleSubject,
            read: ((element, key, keyframes) =>
                elementEffect(element).read(
                    element,
                    key,
                    keyframes
                )) as ElementEffect["read"],
            get: (element: StyleSubject, key: string) =>
                elementEffect(element).get(element, key),
            flush: (element: StyleSubject) =>
                elementEffect(element).flush(element),
            state: (element: StyleSubject) =>
                elementEffect(element).state(element),
            node: (element: StyleSubject) => {
                activeScope.current?.track(element)
                return getElementNode(element) as MotionNode<StyleSubject>
            },
        }
    )
}

/**
 * The effect animate() animates DOM elements through: the style and SVG
 * effects, with what an animation needs of an element. Keyframes are
 * read and resolved against the DOM, units are converted by measurement
 * and eligible values run on WAAPI.
 *
 * The animate() from "motion" has it built in. The one from "motion/core"
 * animates values and plain objects, and gets this with
 * animate.addEffect(domEffect).
 */
export const domEffect = /*@__PURE__*/ createDOMEffect()
