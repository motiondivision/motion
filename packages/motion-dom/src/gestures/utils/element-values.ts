import { readStyleValue, styleSubjectEffect } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import type { MotionNode } from "../../node/MotionNode"
import { nodeStore } from "../../render/store"
import { isSVGElement } from "../../utils/is-svg-element"
import type { MotionValue } from "../../value"

export type TransformValues = [
    scale: MotionValue<number>,
    rotate: MotionValue<number>,
    x: MotionValue<number>,
    y: MotionValue<number>,
]

const valueKeys = ["scale", "rotate", "x", "y"]

/**
 * The element's scale/rotate/x/y motion values, on the node that owns
 * it, created from its current style if this is the first time.
 */
export const getElementValues = (element: Element) => {
    const node: MotionNode =
        nodeStore.get(element) ||
        (isSVGElement(element) ? svgSubjectEffect : styleSubjectEffect).node(
            element as any
        )

    return valueKeys.map(
        (key) =>
            node.getValue(key) ||
            node.getValue(
                key,
                node.readValue(key) ?? readStyleValue(element as any, key)
            )
    ) as TransformValues
}
