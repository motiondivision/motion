import { secondsToMilliseconds } from "motion-utils"
import { supportsLinearEasing } from "../../../utils/supports/linear-easing"
import { createGeneratorEasing } from "../../generators/utils/create-generator-easing"
import { isGenerator } from "../../generators/utils/is-generator"
import { Transition, ValueKeyframesDefinition } from "../../types"
import { mapEasingToNativeEasing } from "./easing"

export interface NativeAnimationDefinition {
    keyframes: PropertyIndexedKeyframes
    options: KeyframeAnimationOptions
}

const defaultEasing = "easeOut"

export function applyGeneratorOptions(options: Transition) {
    if (isGenerator(options.type)) {
        const generatorOptions = createGeneratorEasing(
            options as any,
            100,
            options.type as any
        )

        options.ease = supportsLinearEasing()
            ? generatorOptions.ease
            : defaultEasing
        options.duration = secondsToMilliseconds(generatorOptions.duration)
        options.type = "keyframes"
    } else {
        options.duration = secondsToMilliseconds(options.duration ?? 0.3)
        options.ease = options.ease || defaultEasing
    }
}

// TODO: Reuse for NativeAnimation
export function convertMotionOptionsToNative(
    valueName: string,
    keyframes: ValueKeyframesDefinition,
    options: Transition
): NativeAnimationDefinition {
    const nativeKeyframes: PropertyIndexedKeyframes = {}
    const nativeOptions: KeyframeAnimationOptions = {
        fill: "both",
        easing: "linear",
        composite: "replace",
    }

    nativeOptions.delay = secondsToMilliseconds(options.delay ?? 0)

    applyGeneratorOptions(options)

    nativeOptions.duration = options.duration

    const { ease, times } = options

    if (times) nativeKeyframes.offset = times

    nativeKeyframes[valueName] = keyframes as string[]

    const easing = mapEasingToNativeEasing(ease, options.duration!)

    /**
     * If this is an easing array, apply to keyframes, not animation as a whole
     */
    if (Array.isArray(easing)) {
        nativeKeyframes.easing = easing
    } else {
        nativeOptions.easing = easing
    }

    return {
        keyframes: nativeKeyframes,
        options: nativeOptions,
    }
}
