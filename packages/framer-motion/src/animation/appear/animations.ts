import { variantPriorityOrder, type VisualElement } from "motion-dom"
import { AnimationFeature } from "../../motion/features/animation"
import type { FeaturePackages } from "../../motion/features/types"
import type { EarlyState } from "./early"
import { followAppearAnimations } from "./follow"

/**
 * The animation feature for components whose enter animations start as
 * CSS, and whose gestures work before this arrives. It carries on with
 * the gestures that are active.
 */
class AppearAnimationFeature extends AnimationFeature {
    constructor(node: VisualElement) {
        const early = node.animationState as EarlyState | undefined
        const active = early?.active
        if (active) node.animationState = undefined

        super(node)

        if (active) {
            for (const type of variantPriorityOrder) {
                active[type] && node.animationState!.setActive(type, true)
            }
        }
    }
}

export function loadAnimations(): FeaturePackages {
    followAppearAnimations()
    return { animation: { Feature: AppearAnimationFeature } }
}
