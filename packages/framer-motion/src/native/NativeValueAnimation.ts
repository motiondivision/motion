import {
    AnimationPlaybackControls,
    AnyResolvedKeyframe,
    JSAnimation,
    time,
    ValueAnimationOptions,
} from "motion-dom"
import { createTable, SAMPLE_INTERVAL } from "./table"
import type { NativeHost, NativeTable } from "./types"

/**
 * An animation played on React Native's UI thread, so it keeps running
 * while the JS thread is busy.
 *
 * Like WAAPI animations, its motion value isn't updated every frame.
 * Instead a renderless JSAnimation is sampled whenever JS needs the value:
 * when it's read, and when the animation is stopped, so the next animation
 * starts from the right value and velocity.
 */
export class NativeValueAnimation<T extends AnyResolvedKeyframe>
    implements AnimationPlaybackControls
{
    state: AnimationPlayState = "running"

    startTime: number | null

    finished: Promise<void>

    private resolveFinished!: VoidFunction

    private stopPlayer?: VoidFunction

    /**
     * Time in ms while paused or stopped.
     */
    private holdTime: number | null = null

    constructor(
        private options: ValueAnimationOptions<T>,
        private host: NativeHost,
        private sampler: JSAnimation<T>,
        private table: NativeTable
    ) {
        this.finished = new Promise((resolve) => (this.resolveFinished = resolve))
        this.startTime = options.startTime ?? time.now()
        this.startPlayer(time.now() - this.startTime)
    }

    /**
     * Start the animation on the UI thread, or return nothing if it should
     * run in JS.
     */
    static create<T extends AnyResolvedKeyframe>(
        options: ValueAnimationOptions<T>,
        host: NativeHost
    ) {
        const {
            motionValue,
            onUpdate,
            onComplete,
            onPlay,
            onStop,
            element,
            ...samplerOptions
        } = options

        const sampler = new JSAnimation<T>({
            ...(samplerOptions as ValueAnimationOptions<T>),
            autoplay: false,
        })
        sampler.stop()

        const table = createTable(sampler, options)

        return table && new NativeValueAnimation(options, host, sampler, table)
    }

    private startPlayer(offset: number) {
        this.stopPlayer = this.host.play(
            this.options.name!,
            this.table,
            offset,
            () => this.finish()
        )
    }

    private elapsed() {
        return this.holdTime ?? time.now() - this.startTime!
    }

    private sample(elapsed: number) {
        return this.sampler.sample(Math.max(0, elapsed)).value
    }

    private finish() {
        this.stopPlayer = undefined
        this.state = "finished"
        this.holdTime = this.startTime = null

        this.options.onUpdate?.(
            this.table.samples[this.table.samples.length - 1] as T
        )
        this.options.onComplete?.()
        this.resolveFinished()
    }

    /**
     * Stop the UI thread and write the value it reached to the motion value,
     * with a sample one interval earlier so it keeps its velocity.
     */
    private halt() {
        if (!this.stopPlayer) return false

        this.stopPlayer()
        this.stopPlayer = undefined

        const { motionValue } = this.options

        /**
         * A value set this frame, for instance with `jump()`, which stops
         * this animation, keeps what it was set to.
         */
        if (!motionValue || this.wasSetThisFrame()) return true

        const elapsed = this.elapsed()
        const delta = Math.min(SAMPLE_INTERVAL, Math.max(elapsed, 0))
        const current = this.sample(elapsed)

        delta
            ? motionValue.setWithVelocity(
                  this.sample(elapsed - delta),
                  current,
                  delta
              )
            : motionValue.set(current)

        return true
    }

    private wasSetThisFrame() {
        return this.options.motionValue?.updatedAt === time.now()
    }

    /**
     * Whether the UI thread has played the whole table, even if JS hasn't
     * heard yet because it was busy.
     */
    private hasEnded() {
        return (
            this.state === "running" &&
            !this.table.loopLength &&
            this.elapsed() >= this.table.duration
        )
    }

    liveValue() {
        if (this.state === "running" || this.state === "paused") {
            return this.sample(this.elapsed())
        }
    }

    get duration() {
        return this.sampler.duration
    }

    get iterationDuration() {
        return this.sampler.iterationDuration
    }

    get time() {
        return this.elapsed() / 1000
    }

    set time(seconds: number) {
        const elapsed = seconds * 1000
        this.halt()

        if (this.state === "running") {
            this.startTime = time.now() - elapsed
            this.startPlayer(elapsed)
        } else {
            this.holdTime = elapsed
            this.options.motionValue?.set(this.sample(elapsed))
        }
    }

    /**
     * The table is played at the speed it was sampled.
     */
    get speed() {
        return 1
    }

    set speed(_speed: number) {}

    play() {
        if (this.state !== "paused") return

        const elapsed = this.holdTime!
        this.state = "running"
        this.holdTime = null
        this.startTime = time.now() - elapsed
        this.startPlayer(elapsed)
    }

    pause() {
        if (this.state !== "running") return

        this.holdTime = this.elapsed()
        this.halt()
        this.state = "paused"
    }

    stop() {
        if (this.state === "idle" || this.state === "finished") return

        if (this.hasEnded() && !this.wasSetThisFrame()) {
            this.stopPlayer?.()
            return this.finish()
        }

        this.halt()
        this.state = "idle"
        this.holdTime = this.startTime = null
        this.options.onStop?.()
    }

    complete() {
        this.stopPlayer?.()
        if (this.state !== "finished") this.finish()
    }

    cancel() {
        this.stopPlayer?.()
        this.stopPlayer = undefined
        this.state = "idle"
        this.holdTime = this.startTime = null
        this.options.motionValue?.set(this.sample(0))
        /**
         * onCancel is internal to motion-dom.
         */
        ;(this.options as { onCancel?: VoidFunction }).onCancel?.()
    }

    attachTimeline() {
        return () => {}
    }

    then(onResolve: VoidFunction, onReject?: VoidFunction) {
        return this.finished.then(onResolve, onReject)
    }
}
