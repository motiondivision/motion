import { easingDefinitionToFunction } from "motion-utils"
import { ValueAnimationTransition } from "../../types"

/**
 * Named easings CSS has no equivalent of run as their function, traced
 * into linear().
 */
export function replaceStringEasing(transition: ValueAnimationTransition) {
    const { ease } = transition
    if (ease === "anticipate" || ease === "backInOut" || ease === "circInOut") {
        transition.ease = easingDefinitionToFunction(ease)
    }
}
