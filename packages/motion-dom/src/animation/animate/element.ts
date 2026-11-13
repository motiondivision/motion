import { styleSubjectEffect, StyleSubject } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import type { MotionNode } from "../../node/MotionNode"
import { measureViewportBox } from "../../projection/utils/measure"
import { nodeStore } from "../../render/store"
import { isSVGElement } from "../../utils/is-svg-element"
import { activeScope } from "../../scope/active"
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
 * DOM again. A motion component keeps its values.
 */
export const releaseElement = (element: Element) => {
    const node = nodeStore.get(element)
    node && !(node as any).mount && node.release()
}
