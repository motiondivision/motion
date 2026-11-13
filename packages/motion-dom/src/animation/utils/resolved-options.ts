import { MotionGlobalConfig } from "motion-utils"
import { getFinalKeyframe } from "../keyframes/get-final"
import { ResolvedKeyframes } from "../keyframes/KeyframesResolver"
import { AnyResolvedKeyframe, ValueAnimationOptions } from "../types"
import { canAnimate } from "./can-animate"
import { makeAnimationInstant } from "./make-animation-instant"

/**
 * Fill in the defaults of a value's options, before its keyframes
 * resolve. animateMotionValue builds a fresh options object per value, so
 * it's completed in place rather than copied.
 */
export function fillAnimationDefaults(options: ValueAnimationOptions<any>) {
    options.autoplay ??= true
    options.delay ??= 0
    options.type ??= "keyframes"
    options.repeat ??= 0
    options.repeatDelay ??= 0
    options.repeatType ??= "loop"
}

/**
 * Put resolved keyframes into a value's options. If they can't be
 * animated, the animation is made instant. Returns whether they can.
 */
export function applyResolvedKeyframes<T extends AnyResolvedKeyframe>(
    options: ValueAnimationOptions<T> & { finalKeyframe?: T },
    keyframes: ResolvedKeyframes<T>,
    finalKeyframe: T
) {
    const { name, type, velocity, delay, onUpdate } = options
    const canAnimateValue = canAnimate(keyframes, name, type, velocity)

    if (!canAnimateValue) {
        if (MotionGlobalConfig.instantAnimations || !delay) {
            onUpdate?.(getFinalKeyframe(keyframes, options, finalKeyframe))
        }

        keyframes[0] = keyframes[keyframes.length - 1]

        makeAnimationInstant(options)
        options.repeat = 0
    }

    options.finalKeyframe = finalKeyframe
    options.keyframes = keyframes

    return canAnimateValue
}
