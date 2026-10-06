import { cancelFrame, frame, frameData } from "../frameloop"
import { time } from "../frameloop/sync-time"
import type { FrameData } from "../frameloop/types"
import type { Driver } from "./drivers/types"
import {
    flushKeyframeResolvers,
    KeyframeResolver,
    ResolvedKeyframes,
} from "./keyframes/KeyframesResolver"
import type {
    AnimationPlaybackControls,
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    MotionValueAnimation,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import {
    ResolvedOptions,
    startResolvedAnimation,
} from "./utils/start-resolved-animation"
import { WithPromise } from "./utils/WithPromise"

/**
 * A pool is one animation of one or more values, usually every value in
 * one animate() call or transition on one element. It owns those values
 * until it finishes or another animation takes them, and is the controls
 * returned for them.
 *
 * Each value is a track. A track's keyframes resolve without waiting for
 * the frame loop when nothing needs reading from the DOM, and it then
 * runs as one of:
 *
 * - A WAAPI animation, for values the browser can animate on their own
 *   (opacity, filter, clipPath, ...).
 * - A source in its element's transform group, which composes every
 *   transform value, from any pool, into one WAAPI animation.
 * - A JS animation, ticked by the pool's one frame loop subscription.
 *
 * When another animation takes a value, its track stops: the value is
 * left where it was, with its velocity, for the new animation to start
 * from. A pool whose tracks have all stopped or finished does no more
 * work.
 */
export class PoolAnimation
    extends WithPromise
    implements AnimationPlaybackControlsWithThen
{
    tracks: PoolTrack[] = []

    /**
     * Tracks that haven't finished.
     */
    remaining = 0

    private isSealed = false

    createdAt = time.now()

    timeline: TimelineWithFallback | undefined

    /**
     * Ticks every JS animation in the pool from one frame loop
     * subscription.
     */
    driver: Driver = createPoolDriver()

    add<T extends AnyResolvedKeyframe>(options: ValueAnimationOptions<T>) {
        return new PoolTrack(this, options)
    }

    /**
     * Every track has been added, so the pool can finish once they have.
     */
    seal() {
        this.isSealed = true
        this.checkFinished()
        return this
    }

    checkFinished() {
        this.isSealed && !this.remaining && this.notifyFinished()
    }

    /**
     * The tracks' animations. Reading them resolves any keyframes still
     * waiting for the frame loop, as controls need the animations.
     */
    get animations() {
        const { tracks } = this
        const animations: AnimationPlaybackControls[] = []
        let hasFlushed = false

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i]

            if (!track.animation && !hasFlushed && track.resume()) {
                flushKeyframeResolvers()
                hasFlushed = true
            }

            track.animation && animations.push(track.animation)
        }

        return animations
    }

    private run(method: "play" | "pause" | "complete" | "cancel") {
        this.animations.forEach((animation) => animation[method]())
    }

    private get first() {
        return this.animations[0]
    }

    then(onResolve: VoidFunction, _onReject?: VoidFunction) {
        return this.finished.finally(onResolve).then(() => {})
    }

    get time() {
        return this.first.time
    }

    set time(newTime: number) {
        this.animations.forEach((animation) => (animation.time = newTime))
    }

    get speed() {
        return this.first.speed
    }

    set speed(newSpeed: number) {
        this.animations.forEach((animation) => (animation.speed = newSpeed))
    }

    get state() {
        return this.first.state
    }

    get startTime() {
        return this.first.startTime
    }

    get duration() {
        return getMax(this.animations, "duration")
    }

    get iterationDuration() {
        return getMax(this.animations, "iterationDuration")
    }

    play() {
        const wasFinished = this.isSealed && !this.remaining

        this.tracks.forEach((track) => track.reopen() && this.remaining++)

        wasFinished && this.remaining && this.updateFinished()

        this.run("play")
    }

    pause() {
        this.run("pause")
    }

    complete() {
        this.run("complete")
    }

    cancel() {
        this.tracks.forEach((track) => track.cancel())
    }

    /**
     * Bound to support the `return animation.stop` pattern.
     */
    stop = () => {
        this.tracks.forEach((track) => track.stop())
    }

    attachTimeline(timeline: TimelineWithFallback) {
        this.timeline = timeline
        this.tracks.forEach((track) => track.attachTimeline(timeline))

        return this.stop
    }

    /**
     * A pool of one value can be read while it runs off the main thread.
     */
    liveValue() {
        return this.tracks.length === 1 ? this.tracks[0].liveValue() : undefined
    }
}

/**
 * One value in a pool. This is what the value's `animation` points to,
 * so stopping it (when another animation takes the value) only stops
 * this value.
 */
export class PoolTrack<T extends AnyResolvedKeyframe = any>
    extends WithPromise
    implements MotionValueAnimation
{
    animation: AnimationPlaybackControls | undefined

    private resolver: KeyframeResolver<T> | undefined

    private isStopped = false

    private isComplete = false

    private stopTimeline: VoidFunction | undefined

    constructor(private pool: PoolAnimation, options: ResolvedOptions<T>) {
        super()

        pool.tracks.push(this)
        pool.remaining++

        options.autoplay ??= true
        options.delay ??= 0
        options.type ??= "keyframes"
        options.repeat ??= 0
        options.repeatDelay ??= 0
        options.repeatType ??= "loop"
        options.driver ??= pool.driver

        const { onComplete, keyframes, name, motionValue, element } = options

        options.onComplete = () => {
            onComplete?.()

            /**
             * A finished animation can be played again, and finish again.
             */
            if (!this.isComplete) {
                this.isComplete = true
                this.notifyFinished()
                pool.remaining--
                pool.checkFinished()
            }
        }

        const Resolver = element?.KeyframeResolver || KeyframeResolver

        const resolver = (this.resolver = new Resolver(
            keyframes,
            (
                resolvedKeyframes: ResolvedKeyframes<T>,
                finalKeyframe: T,
                forced: boolean
            ) => this.start(resolvedKeyframes, finalKeyframe, options, !forced),
            name,
            motionValue,
            element
        ))
        resolver.scheduleResolve()
    }

    private start(
        keyframes: ResolvedKeyframes<T>,
        finalKeyframe: T,
        options: ResolvedOptions<T>,
        sync: boolean
    ) {
        this.resolver = undefined

        this.animation = startResolvedAnimation(
            keyframes,
            finalKeyframe,
            options,
            sync,
            this.pool.createdAt,
            time.now()
        )

        const { timeline } = this.pool
        if (timeline) this.attachTimeline(timeline)
    }

    /**
     * Resume resolving keyframes that were cancelled or are waiting for
     * the frame loop. Returns true if there are some.
     */
    resume() {
        if (this.isStopped) return false
        this.resolver?.resume()
        return Boolean(this.resolver)
    }

    /**
     * A finished track that's played again. Returns true if it had
     * finished.
     */
    reopen() {
        if (!this.isComplete) return false
        this.isComplete = false
        this.updateFinished()
        return true
    }

    attachTimeline(timeline: TimelineWithFallback) {
        if (this.animation) {
            this.stopTimeline = this.animation.attachTimeline(timeline)
        }
    }

    get state() {
        return this.animation
            ? this.animation.state
            : this.isStopped
            ? "idle"
            : "running"
    }

    then(onResolve: VoidFunction, _onReject?: VoidFunction) {
        return this.finished.finally(onResolve).then(() => {})
    }

    liveValue() {
        return (
            this.animation as { liveValue?: () => T | undefined }
        )?.liveValue?.()
    }

    cancel() {
        this.animation?.cancel()
        this.resolver?.cancel()
    }

    /**
     * Bound to support the `return animation.stop` pattern.
     */
    stop = () => {
        this.isStopped = true

        if (this.animation) {
            this.animation.stop()
            this.stopTimeline?.()
        }

        this.resolver?.cancel()
    }
}

/**
 * One frame loop subscription that ticks every JS animation in a pool.
 */
function createPoolDriver(): Driver {
    const updates = new Set<(timestamp: number) => void>()
    const tick = ({ timestamp }: FrameData) =>
        updates.forEach((update) => update(timestamp))

    return (update) => ({
        start: (keepAlive = true) => {
            if (keepAlive) {
                updates.add(update)
                frame.update(tick, true)
            } else if (!updates.has(update)) {
                /**
                 * A seek while held renders once.
                 */
                frame.update(({ timestamp }) => update(timestamp))
            }
        },
        stop: () => {
            updates.delete(update)
            updates.size || cancelFrame(tick)
        },
        now: () => (frameData.isProcessing ? frameData.timestamp : time.now()),
    })
}

function getMax(
    animations: AnimationPlaybackControls[],
    propName: "iterationDuration" | "duration"
): number {
    let max = 0

    for (let i = 0; i < animations.length; i++) {
        const value = animations[i][propName]
        if (value !== null && value > max) max = value
    }

    return max
}
