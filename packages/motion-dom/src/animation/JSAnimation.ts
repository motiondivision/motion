import { millisecondsToSeconds, secondsToMilliseconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { frameloopDriver } from "./drivers/frame"
import { DriverControls } from "./drivers/types"
import {
    createTrack,
    getTrackEnd,
    isInertia,
    sampleTrack,
    Track,
    trackVelocity,
} from "./pool/track"
import {
    AnimationPlaybackControlsWithThen,
    AnimationState,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { resolveStartTime } from "./utils/resolve-start-time"
import { notifyAnimationStart } from "./utils/notify-inspector"
import { WithPromise } from "./utils/WithPromise"

export class JSAnimation<T extends number | string>
    extends WithPromise
    implements AnimationPlaybackControlsWithThen
{
    state: AnimationPlayState = "idle"

    startTime: number | null = null

    /**
     * The driver that's controlling the animation loop. Normally this is a requestAnimationFrame loop
     * but in tests we can pass in a synchronous loop.
     */
    private driver?: DriverControls

    private isStopped = false

    /**
     * The start time this animation picked for itself, until its first tick.
     */
    private pendingStartTime?: number

    /**
     * The animation's generator and timing. Shared with Pool, which
     * drives many tracks from one clock.
     */
    private track: Track<T>

    private options: ValueAnimationOptions<T>

    /**
     * The current time of the animation.
     */
    private currentTime: number = 0

    /**
     * The time at which the animation was paused.
     */
    private holdTime: number | null = null

    /**
     * Playback speed as a factor. 0 would be stopped, -1 reverse and 2 double speed.
     */
    private playbackSpeed = 1

    constructor(options: ValueAnimationOptions<T>) {
        super()

        this.options = options
        this.initAnimation()
        this.play()

        if (options.autoplay === false) this.pause()

        notifyAnimationStart(this, this.options)
    }

    initAnimation() {
        this.track = createTrack(this.options)
    }

    private get totalDuration() {
        return this.track.totalDuration
    }

    updateTime(timestamp: number) {
        const animationTime =
            Math.round(timestamp - this.startTime!) * this.playbackSpeed

        // Update currentTime
        if (this.holdTime !== null) {
            this.currentTime = this.holdTime
        } else {
            // Rounding the time because floating point arithmetic is not always accurate, e.g. 3000.367 - 1000.367 =
            // 2000.0000000000002. This is a problem when we are comparing the currentTime with the duration, for
            // example.
            this.currentTime = animationTime
        }
    }

    tick(timestamp: number, sample = false) {
        const { track, totalDuration } = this

        if (this.startTime === null) return track.generator.next(0)

        const { onUpdate } = this.options

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

        const isHeld = this.holdTime !== null
        const state = sampleTrack(
            track,
            this.currentTime,
            this.playbackSpeed,
            this.state === "finished" && !isHeld
        ) as AnimationState<T>

        this.currentTime = (state as any).time

        const isAnimationFinished =
            !isHeld &&
            (this.state === "finished" ||
                (this.state === "running" && state.done))

        // TODO: The exception for inertia could be cleaner here
        if (isAnimationFinished && !isInertia(track)) {
            state.value = getTrackEnd(track, this.speed)
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
     * Allows the returned animation to be awaited or promise-chained. Currently
     * resolves when the animation finishes at all but in a future update could/should
     * reject if its cancels.
     */
    then(resolve: VoidFunction, reject?: VoidFunction) {
        return this.finished.then(resolve, reject)
    }

    get duration() {
        return millisecondsToSeconds(this.track.calculatedDuration)
    }

    get iterationDuration() {
        const { delay = 0 } = this.options || {}
        return this.duration + millisecondsToSeconds(delay)
    }

    get time() {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
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
        return trackVelocity(this.track, this.currentTime)
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
            this.driver = driver((timestamp) => this.tick(timestamp))
        }

        this.options.onPlay?.()

        const now = this.driver.now()

        if (this.state === "finished") {
            this.updateFinished()
            this.startTime = now
        } else if (this.holdTime !== null) {
            this.startTime = now - this.holdTime
        } else if (!this.startTime) {
            this.startTime = startTime ?? (this.pendingStartTime = now)
        }

        if (this.state === "finished" && this.speed < 0) {
            this.startTime += this.track.calculatedDuration
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
    }

    /**
     * This method is bound to the instance to fix a pattern where
     * animation.stop is returned as a reference from a useEffect.
     */
    stop = () => {
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

    private teardown() {
        this.state = "idle"
        this.stopDriver()
        this.startTime = this.holdTime = null
    }

    private stopDriver() {
        if (!this.driver) return
        this.driver.stop()
        this.driver = undefined
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
