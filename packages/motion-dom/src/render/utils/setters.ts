import { motionValue } from "../../value"
import { resolveVariant } from "./resolve-dynamic-variants"
import { isKeyframesTarget } from "./is-keyframes-target"
import type { AnimationDefinition } from "../../node/types"
import type {
    AnyResolvedKeyframe,
    UnresolvedValueKeyframe,
    ValueKeyframesDefinition,
} from "../../animation/types"
import type { VisualElement } from "../VisualElement"

/**
 * Set VisualElement's MotionValue, creating a new MotionValue for it if
 * it doesn't exist.
 */
function setMotionValue(
    visualElement: VisualElement,
    key: string,
    value: AnyResolvedKeyframe
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
        setMotionValue(visualElement, key, value as AnyResolvedKeyframe)
    }
}
