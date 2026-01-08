import { clamp } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { JSAnimation } from "./JSAnimation"
import { NativeAnimation, NativeAnimationOptions } from "./NativeAnimation"
import { AnyResolvedKeyframe, ValueAnimationOptions } from "./types"
import { replaceTransitionType } from "./utils/replace-transition-type"
import { replaceStringEasing } from "./waapi/utils/unsupported-easing"

export type NativeAnimationOptionsExtended<T extends AnyResolvedKeyframe> =
    NativeAnimationOptions & ValueAnimationOptions<T> & NativeAnimationOptions

/**
 * 10ms is chosen here as it strikes a balance between smooth
 * results (more than one keyframe per frame at 60fps) and
 * keyframe quantity.
 */
const sampleDelta = 10 //ms

export class NativeAnimationExtended<
    T extends AnyResolvedKeyframe
> extends NativeAnimation<T> {
    options: NativeAnimationOptionsExtended<T>

    constructor(options: NativeAnimationOptionsExtended<T>) {
        /**
         * The base NativeAnimation function only supports a subset
         * of Motion easings, and WAAPI also only supports some
         * easing functions via string/cubic-bezier definitions.
         *
         * This function replaces those unsupported easing functions
         * with a JS easing function. This will later get compiled
         * to a linear() easing function.
         */
        replaceStringEasing(options)

        /**
         * Ensure we replace the transition type with a generator function
         * before passing to WAAPI.
         *
         * TODO: Does this have a better home? It could be shared with
         * JSAnimation.
         */
        replaceTransitionType(options)

        super(options)

        if (options.startTime !== undefined) {
            this.startTime = options.startTime
        }

        this.options = options
    }

    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * Rather than read committed styles back out of the DOM, we can
     * create a renderless JS animation and sample it twice to calculate
     * its current value, "previous" value, and therefore allow
     * Motion to calculate velocity for any subsequent animation.
     */
    updateMotionValue(value?: T) {
        const { motionValue, onUpdate, onComplete, element, ...options } =
            this.options

        if (!motionValue) return

        if (value !== undefined) {
            motionValue.set(value)
            return
        }

        const sampleAnimation = new JSAnimation({
            ...options,
            autoplay: false,
        })

        /**
         * Use wall-clock elapsed time for sampling.
         * Under CPU load, WAAPI's currentTime may not reflect actual
         * elapsed time, causing incorrect sampling and visual jumps.
         */
        const sampleTime = Math.max(sampleDelta, time.now() - this.startTime)
        const delta = clamp(0, sampleDelta, sampleTime - sampleDelta)

        motionValue.setWithVelocity(
            sampleAnimation.sample(Math.max(0, sampleTime - delta)).value,
            sampleAnimation.sample(sampleTime).value,
            delta
        )

        sampleAnimation.stop()
    }
}
