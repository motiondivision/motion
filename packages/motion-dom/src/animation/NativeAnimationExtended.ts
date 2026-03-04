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

        if (options.startTime !== undefined) {
            this.startTime = options.startTime
        }

        this.options = options
    }

    /**
     * Commit the current animated value to the element's inline style.
     *
     * Uses WAAPI commitStyles when available, otherwise falls back to
     * getComputedStyle (same approach as animateMini's 3-step process).
     */
    protected commitStyles() {
        const element = this.options?.element
        if (this.options?.pseudoElement || !element?.isConnected) return

        if (this.animation.commitStyles) {
            try {
                this.animation.commitStyles()
            } catch (e) {}
        } else {
            const { name } = this.options
            if (name) {
                const computed = window.getComputedStyle(element)[name as any]
                if (computed) setStyle(element, name, computed)
            }
        }
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

        /**
         * For keyframes with complex CSS strings (e.g. transform
         * functions like "translateX(100px)") that JSAnimation cannot
         * properly interpolate, read the committed value from the
         * element's inline style. commitStyles() is called by stop()
         * before this method, and element.style reads are cheap
         * (no layout reflow unlike getComputedStyle).
         */
        const { name } = this.options
        const useCommitted =
            name &&
            element?.style &&
            options.keyframes?.some(
                (k: unknown) =>
                    typeof k === "string" && isNaN(parseFloat(k as string))
            )
        const committed = useCommitted
            ? (element!.style[name as any] as string)
            : undefined

        const current = (committed ||
            sampleAnimation.sample(sampleTime).value) as T

        motionValue.setWithVelocity(
            sampleAnimation.sample(Math.max(0, sampleTime - delta)).value as T,
            current,
            delta
        )

        sampleAnimation.stop()
    }
}
