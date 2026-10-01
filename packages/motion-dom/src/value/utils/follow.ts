import type { MotionValue } from ".."
import { FollowAnimation } from "../../animation/FollowAnimation"
import type {
    AnyResolvedKeyframe,
    GeneratorFactory,
    ValueAnimationOptions,
} from "../../animation/types"
import type { FollowValueOptions } from "../follow-value"
import { asNumber } from "./as-number"
import { isMotionValue } from "./is-motion-value"

export type FollowOptions = FollowValueOptions & { type: GeneratorFactory }

/**
 * Animate `value` to its latest value with the generator in
 * `options.type`, tracking `source` if it's a `MotionValue`. Takes a
 * generator rather than a type name, so spring-only callers don't
 * bundle every generator.
 */
export function follow<T extends AnyResolvedKeyframe>(
    value: MotionValue<T>,
    source: T | MotionValue<T>,
    options: FollowOptions
): VoidFunction {
    const initialValue = value.get()

    let activeAnimation: FollowAnimation | null = null
    let set: (v: T) => void

    const unit =
        typeof initialValue === "string"
            ? initialValue.replace(/[\d.-]/g, "")
            : undefined

    const onUpdate = (v: number) => set((unit ? v + unit : v) as T)

    const onPlay = () => value["events"].animationStart?.notify()

    const stopAnimation = () => {
        if (activeAnimation) {
            activeAnimation.stop()
            activeAnimation = null
        }
        value.animation = undefined
    }

    value.attach((v, safeSet) => {
        set = safeSet
        const target = asNumber(v)

        if (activeAnimation?.state === "running") {
            /**
             * Steer the running animation rather than replacing it. This
             * keeps its completion promise and uses its analytical velocity
             * for accuracy, preventing systematic velocity loss at high
             * frame rates (240hz+).
             */
            activeAnimation.setTarget(target, options.velocity)
            return
        }

        const current = asNumber(value.get())
        const velocity = activeAnimation
            ? activeAnimation.getGeneratorVelocity()
            : value.getVelocity()

        stopAnimation()

        // Don't animate if we're already at the target
        if (current === target) return

        const animationOptions: ValueAnimationOptions<number> = {
            keyframes: [current, target],
            velocity,
            restDelta: 0.001,
            restSpeed: 0.01,
            ...options,
            onUpdate,
        }

        const animation = (activeAnimation = new FollowAnimation({
            ...animationOptions,
            onPlay,
        }))

        value.animation = animation

        animation.then(() => {
            // Ignore if this animation has since been replaced
            if (activeAnimation !== animation) return
            activeAnimation = null
            value.animation = undefined
            value["events"].animationComplete?.notify()
        })
    }, stopAnimation)

    if (isMotionValue(source)) {
        let skipNextAnimation = options.skipInitialAnimation === true

        const removeSourceOnChange = source.on("change", (v) => {
            if (skipNextAnimation) {
                skipNextAnimation = false
                value.jump(parseValue(v, unit) as T, false)
            } else {
                value.set(parseValue(v, unit) as T)
            }
        })

        const removeValueOnDestroy = value.on("destroy", removeSourceOnChange)

        return () => {
            removeSourceOnChange()
            removeValueOnDestroy()
        }
    }

    return stopAnimation
}

function parseValue(v: AnyResolvedKeyframe, unit?: string) {
    return unit ? v + unit : v
}
