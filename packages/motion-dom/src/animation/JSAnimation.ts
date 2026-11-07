import { millisecondsToSeconds, secondsToMilliseconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { Mixer } from "../utils/mix/types"
import { frameloopDriver } from "./drivers/frame"
import { DriverControls } from "./drivers/types"
import { inertia } from "./generators/inertia"
import { calcGeneratorVelocity } from "./generators/utils/velocity"
import { getFinalKeyframe } from "./keyframes/get-final"
import {
    AnimationPlaybackControlsWithThen,
    AnimationState,
    KeyframeGenerator,
    Lane,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { generateTrack, initTrack, Track } from "./track"
import { resolveStartTime } from "./utils/resolve-start-time"
import { notifyAnimationStart } from "./utils/notify-inspector"
import { WithPromise } from "./utils/WithPromise"

export const round = (value: number) => Math.round(value * 10000) / 10000

/**
 * Stop a driver updating every frame, after one more update.
 */
export const holdDriver = (driver: DriverControls) =>
    driver.hold ? driver.hold() : (driver.stop(), driver.start(false))

export class JSAnimation<T extends number | string>
    extends WithPromise
    implements AnimationPlaybackControlsWithThen, Track<T>
{
    state: AnimationPlayState = "idle"

    startTime: number | null = null

    /**
     * The driver that's controlling the animation loop. Normally this is a requestAnimationFrame loop
     * but in tests we can pass in a synchronous loop.
     */
    protected driver?: DriverControls

    protected isStopped = false

    /**
     * The start time this animation picked for itself, until its first tick.
     */
    protected pendingStartTime?: number

    /** @internal */
    generator: KeyframeGenerator<T>

    /** @internal */
    calculatedDuration: number

    /** @internal */
    resolvedDuration: number

    /** @internal */
    totalDuration: number

    /** @internal */
    options: ValueAnimationOptions<T>

    /**
     * The current time of the animation.
     */
    protected currentTime: number = 0

    /**
     * The time at which the animation was paused.
     */
    protected holdTime: number | null = null

    /**
     * Playback speed as a factor. 0 would be stopped, -1 reverse and 2 double speed.
     */
    protected playbackSpeed = 1

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

    /**
     * The generator's two-number blend, when nothing else (repeats or a
     * keyframe mixer) changes its output.
     */
    /** @internal */
    lane?: Lane

    /**
     * @param isDeferred - Don't start until begin() is called, for a
     * subclass that resolves its own keyframes first.
     */
    constructor(options: ValueAnimationOptions<T>, isDeferred?: boolean) {
        super()

        this.options = options
        isDeferred || this.begin()
    }

    protected begin() {
        this.initAnimation()
        this.play()

        if (this.options.autoplay === false) this.pause()

        notifyAnimationStart(this, this.options)
    }

    initAnimation() {
        initTrack(this)
    }

    updateTime(timestamp: number) {
        // Rounding the time because floating point arithmetic is not always accurate, e.g. 3000.367 - 1000.367 =
        // 2000.0000000000002. This is a problem when we are comparing the currentTime with the duration, for
        // example.
        this.currentTime =
            this.holdTime ??
            Math.round(timestamp - this.startTime!) * this.playbackSpeed
    }

    /**
     * The frame loop's update. While running at normal speed between the
     * lane's two times, the value is the lane's blend and nothing else
     * changes, so it's written without the rest of tick().
     */
    step(timestamp: number) {
        const { lane, startTime, driver } = this

        if (
            lane &&
            driver &&
            startTime !== null &&
            startTime <= timestamp &&
            startTime !== this.pendingStartTime &&
            this.state === "running" &&
            this.holdTime === null &&
            this.playbackSpeed === 1
        ) {
            const delay = this.options.delay || 0
            const t = Math.round(timestamp - startTime) - delay

            if (t > lane.start && t < lane.end) {
                /**
                 * Hand the blend to the driver, which runs it each frame
                 * until the time leaves it or playback changes.
                 */
                const { onUpdate, motionValue, hasOnUpdate } = this.options
                const set =
                    hasOnUpdate === false && motionValue
                        ? (latest: T) => motionValue.set(latest)
                        : onUpdate
                driver.lane = {
                    startTime,
                    from: lane.start + delay,
                    to: lane.end + delay,
                    origin: lane.from,
                    delta: lane.delta,
                    ease: lane.ease,
                    delay,
                    write: (latest, currentTime) => {
                        this.currentTime = currentTime
                        set && set(latest as unknown as T)
                    },
                }
                driver.lane.write(
                    lane.from +
                        lane.delta *
                            lane.ease(
                                (t - lane.start) / (lane.end - lane.start)
                            ),
                    t
                )
                return
            }
        }

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
     * This animation's time, including delay, at a timestamp.
     */
    at(timestamp: number) {
        return (
            this.holdTime ??
            round((timestamp - this.startTime!) * this.playbackSpeed)
        )
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

    get time() {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        /**
         * Seeking out of "finished" leaves the animation paused, so play()
         * won't renew finished. Renew it here.
         */
        if (this.state === "finished") this.updateFinished()

        newTime = secondsToMilliseconds(newTime)
        this.currentTime = newTime

        if (
            this.startTime === null ||
            this.holdTime !== null ||
            this.playbackSpeed === 0
        ) {
            this.holdTime = newTime
        } else if (this.driver) {
            this.startTime = this.driver.now() - newTime / this.playbackSpeed
        }

        if (this.driver) {
            this.driver.start(false)
        } else {
            this.startTime = 0
            this.state = "paused"
            this.holdTime = newTime
            this.tick(newTime)
        }
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

    get speed() {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        const hasChanged = this.playbackSpeed !== newSpeed

        if (hasChanged && this.driver) {
            this.updateTime(time.now())
        }

        this.playbackSpeed = newSpeed

        if (hasChanged && this.driver) {
            this.time = millisecondsToSeconds(this.currentTime)
        }
    }

    play() {
        if (this.isStopped) return

        const { driver = frameloopDriver, startTime } = this.options

        if (!this.driver) {
            this.driver = driver((timestamp) => this.step(timestamp))
        }

        this.options.onPlay?.()

        const now = this.driver.now()

        if (this.state === "finished") {
            this.updateFinished()
            this.startTime = now
        } else if (this.holdTime !== null) {
            this.startTime = now - this.holdTime / (this.playbackSpeed || 1)
        } else if (!this.startTime) {
            this.startTime = startTime ?? (this.pendingStartTime = now)
        }

        if (this.state === "finished" && this.speed < 0) {
            this.startTime += this.calculatedDuration
        }

        this.holdTime = null

        /**
         * Set playState to running only after we've used it in
         * the previous logic.
         */
        this.state = "running"

        this.driver.start()
    }

    pause() {
        this.state = "paused"
        this.updateTime(time.now())
        this.holdTime = this.currentTime
        this.hold()
    }

    /**
     * A held animation doesn't move, so rather than tick every frame, it
     * ticks once more to show where it's held. play() or a seek starts it
     * again.
     */
    protected hold() {
        this.driver && holdDriver(this.driver)
    }

    /**
     * This method is bound to the instance to fix a pattern where
     * animation.stop is returned as a reference from a useEffect.
     */
    stop = () => this.stopAnimation()

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

    complete() {
        this.driver && (this.driver.lane = undefined)
        if (this.state !== "running") {
            this.play()
        }

        this.state = "finished"
        this.holdTime = null
    }

    finish() {
        this.notifyFinished()
        this.teardown()
        this.state = "finished"

        this.options.onComplete?.()
    }

    cancel() {
        this.holdTime = null
        this.startTime = 0
        this.tick(0)
        this.teardown()
        this.options.onCancel?.()
    }

    protected teardown() {
        this.state = "idle"
        this.driver?.stop()
        this.driver = undefined
        this.startTime = this.holdTime = null
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
