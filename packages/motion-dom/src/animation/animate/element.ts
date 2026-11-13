import { styleSubjectEffect, StyleSubject } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import { releaseNode, type MotionNode } from "../../node/MotionNode"
import { measureViewportBox } from "../../projection/utils/measure"
import { nodeStore } from "../../render/store"
import { isSVGElement } from "../../utils/is-svg-element"
import { activeScope } from "../../scope/active"
import { transformGroups } from "../waapi/transforms/groups"
import { DOMKeyframesResolver } from "../keyframes/DOMKeyframesResolver"
import { AnimationPlaybackControlsWithThen } from "../types"
import { animateValues, EffectKeyframes, EffectTransition } from "./effects"

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
    let node = nodeStore.get(element)

    if (!node) {
        node = (
            isSVGElement(element) ? svgSubjectEffect : styleSubjectEffect
        ).node(element as any)
    }

    if (!node.KeyframeResolver) {
        node.KeyframeResolver = DOMKeyframesResolver
        node.measureViewportBox = measureNode
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
    node: MotionNode = getElementNode(element)
): AnimationPlaybackControlsWithThen[] {
    activeScope.current?.track(element)

    return animateValues(
        (key) => node.getValue(key, null),
        keyframes,
        transition,
        node
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
