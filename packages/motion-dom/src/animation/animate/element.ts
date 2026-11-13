import {
    isStyleSubject,
    readStyleValue,
    styleSubjectEffect,
    StyleSubject,
} from "../../effects/style"
import { readSVGValue, svgSubjectEffect } from "../../effects/svg"
import type { AnimateEffect } from "../../effects/utils/create-effect"
import { releaseNode, type MotionNode } from "../../node/MotionNode"
import { measureViewportBox } from "../../projection/utils/measure"
import { nodeStore } from "../../render/store"
import { isSVGElement } from "../../utils/is-svg-element"
import { activeScope } from "../../scope/active"
import { transformGroups } from "../waapi/transforms/groups"
import { DOMKeyframesResolver } from "../keyframes/DOMKeyframesResolver"
import { AnimationPlaybackControlsWithThen } from "../types"
import {
    MultiValueRef,
    animateValues,
    EffectKeyframes,
    EffectTransition,
} from "./effects"

/**
 * The hooks `animate()` resolves elements through: whether an effect
 * claims a subject, and the subject's current value as an animation's
 * origin. They're attached here, which only `animate()` loads, so a
 * `styleEffect()` or `svgEffect()` import alone doesn't bundle the
 * computed-style and transform-matrix readers. The selector effects'
 * `test` and `read` forward to these.
 *
 * Attached from a pure call whose result `getElementNode` reads, so a
 * bundle that keeps this module but never calls `animate()` (like a
 * library that flattens Motion into one file) can still drop it.
 */
const attachHooks = () => {
    Object.assign(styleSubjectEffect, {
        test: isStyleSubject,
        read: readStyleValue,
    })
    Object.assign(svgSubjectEffect, { test: isSVGElement, read: readSVGValue })
    return [styleSubjectEffect, svgSubjectEffect] as ElementEffect[]
}

type ElementEffect = AnimateEffect<StyleSubject>

const elementEffects = /*@__PURE__*/ attachHooks()

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
    const effect = elementEffects[isSVGElement(element) ? 1 : 0]
    const node = nodeStore.get(element) || effect.node(element)

    /**
     * A node made by styleEffect() or svgEffect() alone has no way to
     * read the element. One an effect made reads as that effect does.
     */
    if (!node.KeyframeResolver) {
        node.KeyframeResolver = DOMKeyframesResolver
        node.measureViewportBox = measureNode
        node.read ||= effect.read
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
