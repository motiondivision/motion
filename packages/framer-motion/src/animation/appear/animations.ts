import { variantPriorityOrder, type VisualElement } from "motion-dom"
import { AnimationFeature } from "../../motion/features/animation"
import type { FeaturePackages } from "../../motion/features/types"
import type { EarlyState } from "./early"
import {
    followAppearAnimations,
    settleAppearAnimations,
    takeOverHeld,
} from "./follow"

/**
 * The animation feature for components whose enter animations start as
 * CSS, and whose gestures work before this arrives. It carries on with
 * the gestures, and the exit, that are active.
 */
class AppearAnimationFeature extends AnimationFeature {
    constructor(node: VisualElement) {
        const early = node.animationState as EarlyState | undefined
        const active = early?.active
        if (active) node.animationState = undefined

        super(node)

        const state = node.animationState!
        const { animateChanges } = state

        /**
         * The first time the component's animations are started is when
         * its values have asked to follow their CSS animations.
         */
        state.animateChanges = (type) => {
            const animation = animateChanges(type)
            state.animateChanges = animateChanges
            settleAppearAnimations(node)
            return animation
        }

        if (active) {
            early!.unmount()
            takeOverHeld(node)

            for (const type of variantPriorityOrder) {
                if (!active[type]) continue

                const animation = state.setActive(type, true)
                type === "exit" && animation.then(early!.onExit)
            }
        }
    }
}

export function loadAnimations(): FeaturePackages {
    followAppearAnimations()
    return { animation: { Feature: AppearAnimationFeature } }
}
