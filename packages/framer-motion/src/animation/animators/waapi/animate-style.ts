import {
    AnimationPlaybackControls,
    AnimationScope,
    DOMKeyframesDefinition,
    AnimationOptions as DynamicAnimationOptions,
    ElementOrSelector,
    GroupPlaybackControls,
} from "motion-dom"
import { animateElements } from "./animate-elements"

export const createScopedWaapiAnimate = (scope?: AnimationScope) => {
    function scopedAnimate(
        elementOrSelector: ElementOrSelector,
        keyframes: DOMKeyframesDefinition,
        options?: DynamicAnimationOptions
    ): AnimationPlaybackControls {
        return new GroupPlaybackControls(
            animateElements(
                elementOrSelector,
                keyframes as DOMKeyframesDefinition,
                options,
                scope
            )
        )
    }

    return scopedAnimate
}

export const animateMini = /*@__PURE__*/ createScopedWaapiAnimate()
