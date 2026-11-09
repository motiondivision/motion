import { millisecondsToSeconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { Mixer } from "../utils/mix/types"
import { inertia } from "./generators/inertia"
import { calcGeneratorVelocity } from "./generators/utils/velocity"
import { getFinalKeyframe } from "./keyframes/get-final"
import {
    AnimationState,
    KeyframeGenerator,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { generateTrack, initTrack } from "./track"
import { resolveStartTime } from "./utils/resolve-start-time"
import { notifyAnimationStart } from "./utils/notify-inspector"
import { AnimationClock } from "./AnimationClock"

/**
 * A JSAnimation is a Track with its own clock. It doesn't declare
 * `implements Track`, as its track fields are left out of the published
 * declarations, which would then fail to implement the interface.
 */
export class JSAnimation<T extends number | string> extends AnimationClock<T> {
    /** @internal */
    generator: KeyframeGenerator<T>

    /** @internal */
    resolvedDuration: number

    /*
     * If our generator doesn't support mixing numbers, we need to replace keyframes with
     * [0, 100] and then make a function that maps that to the actual keyframes.
     *
     * 100 is chosen instead of 1 as it works nicer with spring animations.
     */
    /** @internal */
    mixKeyframes: Mixer<T> | undefined

    /** @internal */
    mirroredGenerator: KeyframeGenerator<T> | undefined

    /**
     * Reusable state object for the delay phase to avoid
     * allocating a new object every frame.
     */
    /** @internal */
    delayState?: AnimationState<T>

    constructor(options: ValueAnimationOptions<T>) {
        super(options)

        this.initAnimation()
        this.play()

        if (options.autoplay === false) this.pause()

        notifyAnimationStart(this, options)
    }

    initAnimation() {
        initTrack(this)
    }

    /**
     * The frame loop's update.
     */
    step(timestamp: number) {
        this.tick(timestamp)
    }

    tick(timestamp: number, sample = false) {
        const { generator, totalDuration, calculatedDuration } = this

        if (this.startTime === null) return generator.next(0)

        const {
            delay = 0,
            keyframes,
            type,
            onUpdate,
            finalKeyframe,
        } = this.options

        if (this.startTime === this.pendingStartTime) {
            this.startTime = resolveStartTime(this.startTime, timestamp)
        }
        this.pendingStartTime = undefined

        /**
         * requestAnimationFrame timestamps can come through as lower than
         * the startTime as set by performance.now(). Here we prevent this,
         * though in the future it could be possible to make setting startTime
         * a pending operation that gets resolved here.
         */
        if (this.speed > 0) {
            this.startTime = Math.min(this.startTime, timestamp)
        } else if (this.speed < 0) {
            this.startTime = Math.min(
                timestamp - totalDuration / this.speed,
                this.startTime
            )
        }

        if (sample) {
            this.currentTime = timestamp
        } else {
            this.updateTime(timestamp)
        }

        // Rebase on delay
        const timeWithoutDelay =
            this.currentTime - delay * (this.playbackSpeed >= 0 ? 1 : -1)
        const isInDelayPhase =
            this.playbackSpeed >= 0
                ? timeWithoutDelay < 0
                : timeWithoutDelay > totalDuration
        this.currentTime = Math.max(timeWithoutDelay, 0)

        // If this animation has finished, set the current time  to the total duration.
        if (this.state === "finished" && this.holdTime === null) {
            this.currentTime = totalDuration
        }

        const state = this.generate(this.currentTime, isInDelayPhase)

        let { done } = state

        /**
         * A generator that takes longer than maxGeneratorDuration to finish
         * has an Infinity duration, so played forwards it finishes when it
         * says it's done.
         */
        if (!isInDelayPhase) {
            done =
                this.playbackSpeed >= 0
                    ? calculatedDuration < Infinity
                        ? this.currentTime >= totalDuration
                        : done
                    : this.currentTime <= 0
        }

        const isAnimationFinished =
            this.holdTime === null &&
            (this.state === "finished" || (this.state === "running" && done))

        // TODO: The exception for inertia could be cleaner here
        if (isAnimationFinished && type !== inertia) {
            state.value = getFinalKeyframe(
                keyframes,
                this.options,
                finalKeyframe,
                this.speed
            )
        }

        if (onUpdate) {
            onUpdate(state.value)
        }

        if (isAnimationFinished) {
            this.finish()
        }

        return state
    }

    /**
     * The value at a timestamp, without changing this animation's state.
     * If resolved, it ends at the last resolved keyframe, which is in the
     * same unit as the others, rather than at finalKeyframe.
     */
    sampleAt(timestamp: number, resolved?: boolean): T {
        return this.sampleTime(this.at(timestamp), resolved)
    }

    /**
     * The value at a time in ms, delay included, as sampleAt().
     */
    sampleTime(time: number, resolved?: boolean): T {
        const { options, totalDuration } = this
        const t = time - (options.delay || 0)

        return t >= totalDuration && options.type !== inertia
            ? getFinalKeyframe(
                  options.keyframes,
                  options,
                  resolved ? undefined : options.finalKeyframe
              )
            : this.generate(Math.max(t, 0), t < 0).value
    }

    /**
     * The generator's state `currentTime` ms after the delay, without
     * changing the animation's own state.
     */
    protected generate(
        currentTime: number,
        isInDelayPhase: boolean
    ): AnimationState<T> {
        return generateTrack(this, currentTime, isInDelayPhase)
    }

    get duration() {
        return millisecondsToSeconds(this.calculatedDuration)
    }

    get iterationDuration() {
        return this.duration + millisecondsToSeconds(this.options.delay ?? 0)
    }

    /**
     * Returns the generator's velocity at the current time in units/second.
     * Uses the analytical derivative when available (springs), avoiding
     * the MotionValue's frame-dependent velocity estimation.
     */
    getGeneratorVelocity(): number {
        return calcGeneratorVelocity(
            this.generator,
            this.currentTime,
            this.options.velocity
        )
    }

    protected stopAnimation() {
        const { motionValue } = this.options
        if (motionValue && motionValue.updatedAt !== time.now()) {
            this.tick(time.now())
        }

        this.isStopped = true
        if (this.state === "idle") return
        this.teardown()
        this.options.onStop?.()
    }

    finish() {
        this.notifyFinished()
        this.teardown()
        this.state = "finished"

        this.options.onComplete?.()
    }

    sample(sampleTime: number): AnimationState<T> {
        this.startTime = 0
        return this.tick(sampleTime, true)
    }

    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        if (this.options.allowFlatten) {
            this.options.type = "keyframes"
            this.options.ease = "linear"
            this.initAnimation()
        }

        this.driver?.stop()
        return timeline.observe(this)
    }
}

// Legacy function support
export function animateValue<T extends number | string>(
    options: ValueAnimationOptions<T>
) {
    return new JSAnimation(options)
}
