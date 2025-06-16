import type {
    AnimationDefinition,
    UnresolvedValueKeyframe,
    ValueKeyframesDefinition,
} from "motion-dom"
import { motionValue } from "motion-dom"
import { isKeyframesTarget } from "../../animation/utils/is-keyframes-target"
import type { VisualElement } from "../VisualElement"
import { resolveVariant } from "./resolve-dynamic-variants"

/**
 * Set VisualElement's MotionValue, creating a new MotionValue for it if
 * it doesn't exist.
 */
function setMotionValue(
    visualElement: VisualElement,
    key: string,
    value: string | number
) {
    if (visualElement.hasValue(key)) {
        visualElement.getValue(key)!.set(value)
    } else {
        visualElement.addValue(key, motionValue(value))
    }
}

function resolveFinalValueInKeyframes(
    v: ValueKeyframesDefinition
): UnresolvedValueKeyframe {
    // TODO maybe throw if v.length - 1 is placeholder token?
    return isKeyframesTarget(v) ? v[v.length - 1] || 0 : v
}

export function setTarget(
    visualElement: VisualElement,
    definition: AnimationDefinition
) {
    const resolved = resolveVariant(visualElement, definition)
    let { transitionEnd = {}, transition = {}, ...target } = resolved || {}

    target = { ...target, ...transitionEnd }

    for (const key in target) {
        const value = resolveFinalValueInKeyframes(
            target[key as keyof typeof target] as any
        )
        setMotionValue(visualElement, key, value as string | number)
    }
}
