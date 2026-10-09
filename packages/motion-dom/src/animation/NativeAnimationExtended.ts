import { clamp } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { setStyle } from "../render/dom/style-set"
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

        /**
         * Only set startTime when the animation should autoplay.
         * Setting startTime on a paused WAAPI animation unpauses it
         * (per the WAAPI spec), which breaks autoplay: false.
         */
        if (options.startTime !== undefined && options.autoplay !== false) {
            this.startTime = options.startTime
        }

        this.options = options
    }

    private sampler?: JSAnimation<T>

    /**
     * The animation's time now, in ms. Wall-clock rather than WAAPI's
     * currentTime while running, as under CPU load currentTime may not
     * reflect the actual elapsed time, causing incorrect sampling and
     * visual jumps.
     */
    private elapsed() {
        return this.state === "running"
            ? (time.now() - this.startTime) * this.speed
            : this.time * 1000
    }

    /**
     * The value at a time, from a renderless JS animation.
     */
    private sample(sampleTime: number) {
        if (!this.sampler) {
            const {
                motionValue,
                onUpdate,
                onComplete,
                onPlay,
                onStop,
                element,
                ...options
            } = this.options

            /**
             * Stop it straight away so its driver doesn't run every frame.
             * It can still be sampled.
             */
            this.sampler = new JSAnimation({ ...options, autoplay: false })
            this.sampler.stop()
        }

        return this.sampler.sample(Math.max(0, sampleTime)).value
    }

    /**
     * The value now, as WAAPI doesn't set the motion value while it runs.
     */
    liveValue() {
        const { state } = this

        if (state === "running" || state === "paused") {
            return this.sample(this.elapsed())
        }
    }

    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * Rather than read committed styles back out of the DOM, we can
     * sample a renderless JS animation twice to calculate its current
     * value, "previous" value, and therefore allow Motion to calculate
     * velocity for any subsequent animation.
     */
    updateMotionValue(value?: T) {
        const { motionValue, element, name } = this.options

        if (!motionValue) return

        if (value !== undefined) {
            motionValue.set(value)
            return
        }

        const { speed } = this
        const sampleTime = this.elapsed()
        const delta =
            this.state === "running" && speed
                ? clamp(0, sampleDelta, sampleTime)
                : 0
        const current = this.sample(sampleTime)

        /**
         * Write the estimated value to inline style so it persists
         * after cancel(), covering the async gap before the next
         * animation starts.
         */
        if (element && name) setStyle(element, name, current)

        motionValue.setWithVelocity(
            this.sample(sampleTime - delta * Math.sign(speed)),
            current,
            delta / Math.abs(speed || 1)
        )
    }
}
