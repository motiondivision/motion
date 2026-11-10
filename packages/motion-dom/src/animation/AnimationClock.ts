import { millisecondsToSeconds, secondsToMilliseconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { frameloopDriver } from "./drivers/frame"
import { DriverControls } from "./drivers/types"
import {
    AnimationPlaybackControlsWithThen,
    AnimationState,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { WithPromise } from "./utils/WithPromise"

export const round = (value: number) => Math.round(value * 10000) / 10000

/**
 * The clock and playback a JSAnimation and a MultiValueAnimation share:
 * time, speed, play, pause and their driver. What's sampled each frame
 * is the subclass's own.
 */
export abstract class AnimationClock<T extends number | string>
    extends WithPromise
    implements AnimationPlaybackControlsWithThen
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
    calculatedDuration: number

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

    constructor(options: ValueAnimationOptions<T>) {
        super()
        this.options = options
    }

    abstract get duration(): number

    abstract get iterationDuration(): number

    /**
     * The frame loop's update.
     */
    abstract step(timestamp: number): void

    abstract tick(timestamp: number, sample?: boolean): AnimationState<T>

    protected abstract stopAnimation(): void

    abstract finish(): void

    abstract attachTimeline(timeline: TimelineWithFallback): VoidFunction

    updateTime(timestamp: number) {
        // Rounding the time because floating point arithmetic is not always accurate, e.g. 3000.367 - 1000.367 =
        // 2000.0000000000002. This is a problem when we are comparing the currentTime with the duration, for
        // example.
        this.currentTime =
            this.holdTime ??
            Math.round(timestamp - this.startTime!) * this.playbackSpeed
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

    get time() {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        this.setTime(newTime)
    }

    /**
     * The time setter, as a method, so a subclass can add to it with a
     * plain super call. `super.time =` is a slow path in V8, and this runs
     * for every animation of a seeked sequence.
     */
    protected setTime(newTime: number) {
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

    get speed() {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        this.setSpeed(newSpeed)
    }

    protected setSpeed(newSpeed: number) {
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
        /**
         * A held animation doesn't move, so rather than tick every frame,
         * it ticks once more to show where it's held. play() or a seek
         * starts it again.
         */
        const { driver } = this
        driver && (driver.stop(), driver.start(false))
    }

    /**
     * This method is bound to the instance to fix a pattern where
     * animation.stop is returned as a reference from a useEffect.
     */
    stop = () => this.stopAnimation()

    complete() {
        if (this.state !== "running") {
            this.play()
        }

        this.state = "finished"
        this.holdTime = null
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
}
