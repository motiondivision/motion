import { activeAnimations } from "../../stats/animation-count"
import { statsBuffer } from "../../stats/buffer"
import { Transition, ValueKeyframesDefinition } from "../types"
import { mapEasingToNativeEasing } from "./easing/map-easing"

export function startWaapiAnimation(
    element: Element,
    valueName: string,
    keyframes: ValueKeyframesDefinition,
    {
        delay = 0,
        duration = 300,
        repeat = 0,
        repeatType = "loop",
        ease = "easeOut",
        times,
    }: Transition = {},
    pseudoElement: string | undefined = undefined
) {
    const keyframeOptions: PropertyIndexedKeyframes = {
        [valueName]: keyframes as string[],
    }
    if (times) keyframeOptions.offset = times

    const easing = mapEasingToNativeEasing(ease, duration)

    /**
     * If this is an easing array, apply to keyframes, not animation as a whole
     */
    if (Array.isArray(easing)) keyframeOptions.easing = easing

    if (statsBuffer.value) {
        activeAnimations.waapi++
    }

    const options: KeyframeAnimationOptions = {
        delay,
        duration,
        easing: !Array.isArray(easing) ? easing : "linear",
        fill: "both",
        iterations: repeat + 1,
        direction: repeatType === "reverse" ? "alternate" : "normal",
    }

    if (pseudoElement) options.pseudoElement = pseudoElement

    const animation = element.animate(keyframeOptions, options)

    if (statsBuffer.value) {
        animation.finished.finally(() => {
            activeAnimations.waapi--
        })
    }

    return animation
}
