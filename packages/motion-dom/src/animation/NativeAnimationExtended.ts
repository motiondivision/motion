import { secondsToMilliseconds } from "motion-utils"
import { JSAnimation } from "./JSAnimation"
import { NativeAnimation, NativeAnimationOptions } from "./NativeAnimation"
import {
    AnyResolvedKeyframe,
    GeneratorFactory,
    ValueAnimationOptions,
} from "./types"
import { replaceTransitionType } from "./utils/replace-transition-type"
import { replaceStringEasing } from "./waapi/utils/unsupported-easing"
import { isGenerator } from "./generators/utils/is-generator"
import {
    SimulationFrame,
    pregenerateKeyframesWithVelocity,
    interpolateFrame,
} from "./generators/utils/pregenerate-with-velocity"

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

    /**
     * SSGOI-style pre-simulated frames for accurate mid-animation state extraction
     * Instead of creating a JSAnimation for sampling, we use binary search + interpolation
     */
    private simulationFrames: SimulationFrame[] | null = null

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

        if (options.startTime) {
            this.startTime = options.startTime
        }

        this.options = options

        /**
         * SSGOI-style optimization: Pre-generate simulation frames with velocity data
         * This enables O(log n) state lookup instead of creating a new JSAnimation
         */
        this.initSimulationFrames(options)
    }

    /**
     * Pre-generate simulation frames for spring/generator-based animations
     * Based on SSGOI's css-runner approach
     */
    private initSimulationFrames(
        options: NativeAnimationOptionsExtended<T>
    ): void {
        const { type, keyframes } = options as any

        // Only for generator-based animations (spring, inertia)
        if (!isGenerator(type) || !keyframes?.length) {
            return
        }

        try {
            // Create a generator with the same options
            const generator = (type as GeneratorFactory)({
                ...options,
                keyframes: keyframes,
            })

            // Create resolver function for velocity calculation
            const resolveValue = (t: number) => generator.next(t).value

            // Pre-generate frames with position and velocity data
            const { frames } = pregenerateKeyframesWithVelocity(
                generator,
                resolveValue
            )

            this.simulationFrames = frames
        } catch {
            // Fallback to JSAnimation method if pre-generation fails
            this.simulationFrames = null
        }
    }

    /**
     * WAAPI doesn't natively have any interruption capabilities.
     *
     * SSGOI-style optimization:
     * Instead of creating a JSAnimation and sampling twice, we use
     * pre-simulated frames with binary search + linear interpolation.
     * This provides O(log n) performance and no GC overhead.
     *
     * Fallback: If simulation frames are not available, use the original
     * JSAnimation approach.
     */
    updateMotionValue(value?: T) {
        const { motionValue, onUpdate, onComplete, element, ...options } =
            this.options

        if (!motionValue) return

        if (value !== undefined) {
            motionValue.set(value)
            return
        }

        const sampleTime = secondsToMilliseconds(this.finishedTime ?? this.time)

        // SSGOI-style: Use pre-simulated frames if available
        if (this.simulationFrames && this.simulationFrames.length > 0) {
            // Binary search + interpolation for O(log n) lookup
            const currentState = interpolateFrame(
                this.simulationFrames,
                sampleTime
            )
            const prevState = interpolateFrame(
                this.simulationFrames,
                sampleTime - sampleDelta
            )

            motionValue.setWithVelocity(
                prevState.position as T,
                currentState.position as T,
                sampleDelta
            )
            return
        }

        // Fallback: Original JSAnimation approach
        const sampleAnimation = new JSAnimation({
            ...options,
            autoplay: false,
        })

        motionValue.setWithVelocity(
            sampleAnimation.sample(sampleTime - sampleDelta).value,
            sampleAnimation.sample(sampleTime).value,
            sampleDelta
        )

        sampleAnimation.stop()
    }
}
