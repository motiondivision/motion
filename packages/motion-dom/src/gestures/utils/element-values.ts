import { readStyleValue, styleSubjectEffect } from "../../effects/style"
import { svgSubjectEffect } from "../../effects/svg"
import { visualElementStore } from "../../render/store"
import { isSVGElement } from "../../utils/is-svg-element"
import { motionValue, type MotionValue } from "../../value"

export type TransformValues = [
    scale: MotionValue<number>,
    rotate: MotionValue<number>,
    x: MotionValue<number>,
    y: MotionValue<number>,
]

const valueKeys = ["scale", "rotate", "x", "y"]

/**
 * The element's scale/rotate/x/y motion values: those of its
 * VisualElement if it has one (it's a <motion.*> component, or drag() or
 * animateLayout() own it), otherwise those animate() binds to it, created
 * from its current style if this is the first time.
 */
export const getElementValues = (element: Element) => {
    const visualElement = visualElementStore.get(element)
    const effect = isSVGElement(element) ? svgSubjectEffect : styleSubjectEffect

    return valueKeys.map((key) => {
        if (visualElement) {
            return visualElement.getValue(key, key === "scale" ? 1 : 0)
        }

        let value = effect.get(element as any, key)

        if (!value) {
            value = motionValue(readStyleValue(element as any, key))
            effect(element as any, { [key]: value })
        }

        return value
    }) as TransformValues
}
