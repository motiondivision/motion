import { mapEasingToNativeEasing } from "motion-dom"
import { activeAnimations } from "../../../stats/animation-count"
import { statsBuffer } from "../../../stats/buffer"
import { NativeAnimationOptions } from "./types"

export function startWaapiAnimation(
    element: Element,
    valueName: string,
    keyframes: string | number | string[] | number[],
    {
        delay = 0,
        duration = 300,
        repeat = 0,
        repeatType = "loop",
        ease = "easeInOut",
        times,
    }: NativeAnimationOptions = {}
) {
    const keyframeOptions: PropertyIndexedKeyframes = { [valueName]: keyframes }
    if (times) keyframeOptions.offset = times

    const easing = mapEasingToNativeEasing(ease, duration)

    /**
     * If this is an easing array, apply to keyframes, not animation as a whole
     */
    if (Array.isArray(easing)) keyframeOptions.easing = easing

    if (statsBuffer.value) {
        activeAnimations.waapi++
    }

    const animation = element.animate(keyframeOptions, {
        delay,
        duration,
        easing: !Array.isArray(easing) ? easing : "linear",
        fill: "both",
        iterations: repeat + 1,
        direction: repeatType === "reverse" ? "alternate" : "normal",
    })

    if (statsBuffer.value) {
        animation.finished.finally(() => {
            activeAnimations.waapi--
        })
    }

    return animation
}
