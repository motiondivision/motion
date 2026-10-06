import {
    millisecondsToSeconds,
    MotionGlobalConfig,
    noop,
    secondsToMilliseconds,
} from "motion-utils"
import { time } from "../../frameloop/sync-time"
import type { MotionValue } from "../../value"
import { frameloopDriver } from "../drivers/frame"
import { DriverControls } from "../drivers/types"
import { getFinalKeyframe } from "../keyframes/get-final"
import {
    flushKeyframeResolvers,
    KeyframeResolver as DefaultKeyframeResolver,
    ResolvedKeyframes,
} from "../keyframes/KeyframesResolver"
import { AnimationElement } from "../keyframes/types"
import {
    AnimationPlaybackControlsWithThen,
    AnyResolvedKeyframe,
    MotionValueAnimation,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "../types"
import { canAnimate } from "../utils/can-animate"
import { isCSSVariableToken } from "../utils/is-css-variable"
import { makeAnimationInstant } from "../utils/make-animation-instant"
import { notifyAnimationStart } from "../utils/notify-inspector"
import { resolveStartTime } from "../utils/resolve-start-time"
import { supportsScrollTimeline } from "../../utils/supports/scroll-timeline"
import { WithPromise } from "../utils/WithPromise"
import {
    blockChannel,
    canAccelerate,
    Channel,
    ChannelOwner,
    claimChannel,
    completeChannel,
    demoteChannel,
    getChannelProperty,
    hasChannel,
    releaseFromChannel,
    syncChannel,
    windDownChannel,
} from "./channels"
import {
    createTrack,
    getTrackEnd,
    isInertia,
    sampleTrack,
    Track,
    trackEnd,
} from "./track"

/**
 * The velocity of an accelerated value is read from its track over this
 * many ms, matching the main-thread animations' frame interval.
 */
const velocityDelta = 10

/**
 * One value's animation within a pool.
 */
export interface PoolTrack<T extends AnyResolvedKeyframe = any>
    extends Track<T> {
    key: string
    value: MotionValue<T>
    /**
     * Resolves the `value.start()` promise and clears `value.animation`.
     */
    complete: VoidFunction
    handle: TrackHandle
    /**
     * The channel this track plays on while accelerated.
     */
    channel?: Channel
    /**
     * Whether this track is written on the pool's JS tick.
     */
    isJS: boolean
    /**
     * The channel this JS track is blocking while it writes its property.
     */
    blocking?: Channel
    done: boolean
    released: boolean
    resolver?: DefaultKeyframeResolver
}

/**
 * A value's view of the pool animating it. Stopping it releases just this
 * value: the pool carries on with the rest, and winds down when it owns
 * none.
 */
export class TrackHandle extends WithPromise implements MotionValueAnimation {
    constructor(public pool: Pool, public track: PoolTrack) {
        super()
    }

    get state() {
        return this.pool.state
    }

    stop = () => this.pool.release(this.track)

    finish() {
        this.notifyFinished()
    }

    /**
     * While accelerated, the value isn't written every frame, so read it
     * from the track on demand.
     */
    current() {
        const { track, pool } = this
        return track.channel && !track.done && pool.startTime !== null
            ? sampleTrack(track, pool.currentTime, pool.speed).value
            : undefined
    }
}

/**
 * A pool is one animation of many values on one element: normally one
 * `animate()` call or one transition. It resolves every value's keyframes
 * in one pass, drives the values that run on the main thread from one
 * frameloop subscription, and hands the rest to the element's channels,
 * where each CSS property is one hardware-accelerated animation.
 *
 * Values move between pools. An interrupting animation releases a value
 * from its old pool, which samples its exact value and velocity for the
 * new one to start from. A pool that owns no values winds down.
 */
export class Pool extends WithPromise implements AnimationPlaybackControlsWithThen {
    state: AnimationPlayState = "idle"

    startTime: number | null = null

    holdTime: number | null = null

    owner?: ChannelOwner

    private element?: AnimationElement

    private tracks: PoolTrack[] = []

    private jsTracks: PoolTrack[] = []

    private channels = new Set<Channel>()

    private driver?: DriverControls

    private createdAt: number

    private pendingStartTime?: number

    private playbackSpeed = 1

    private isStopped = false

    /**
     * Tracks that have neither finished nor been released.
     */
    private active = 0

    private wasReleased = false

    private pendingResolvers = 0

    private pendingTimeline?: TimelineWithFallback

    constructor(element?: AnimationElement) {
        super()
        this.createdAt = time.now()
        this.element = element
        this.owner = element as ChannelOwner | undefined
    }

    /**
     * Add a value to the pool, from within `value.start()`. Keyframes are
     * resolved once every value has been added.
     */
    add<T extends AnyResolvedKeyframe>(
        key: string,
        value: MotionValue<T>,
        options: ValueAnimationOptions<T>,
        complete: VoidFunction
    ): TrackHandle {
        options.autoplay ??= true
        options.delay ??= 0
        options.type ??= "keyframes"
        options.repeat ??= 0
        options.repeatDelay ??= 0
        options.repeatType ??= "loop"
        options.name = key
        options.motionValue = value

        const track = {
            options,
            key,
            value,
            complete,
            isJS: true,
            done: false,
            released: false,
        } as PoolTrack<T>

        track.handle = new TrackHandle(this, track)

        const { element } = this
        const KeyframeResolver =
            element?.KeyframeResolver || DefaultKeyframeResolver

        track.resolver = new KeyframeResolver(
            options.keyframes,
            (resolved: ResolvedKeyframes<T>, finalKeyframe: T) =>
                this.onResolved(track, resolved, finalKeyframe),
            key,
            value,
            element as any
        )

        this.tracks.push(track)
        this.pendingResolvers++
        this.active++

        return track.handle
    }

    /**
     * Resolve every track's keyframes. When nothing needs reading from the
     * DOM, this happens now, so the animation starts in the same task.
     * Otherwise reads are batched into the frameloop with every other
     * animation's, as before.
     */
    resolve() {
        const { tracks, element } = this
        const needsRead = Boolean(element?.current)

        let needsDOM = false
        if (needsRead) {
            for (const { options, value } of tracks) {
                const { keyframes } = options
                if (keyframes[0] === null && value.get() === undefined) {
                    needsDOM = true
                    break
                }
                for (const keyframe of keyframes) {
                    if (
                        typeof keyframe === "string" &&
                        isCSSVariableToken(keyframe.trim())
                    ) {
                        needsDOM = true
                        break
                    }
                }
            }
        }

        if (!needsDOM) {
            for (const { resolver } of tracks) {
                resolver!.readKeyframes()
                needsDOM ||= resolver!.needsMeasurement
            }
        }

        for (const { resolver } of tracks) {
            needsDOM ? resolver!.scheduleResolve() : resolver!.complete()
        }
    }

    private onResolved<T extends AnyResolvedKeyframe>(
        track: PoolTrack<T>,
        keyframes: ResolvedKeyframes<T>,
        finalKeyframe: T
    ) {
        const { options } = track
        const { name, type, velocity, delay, onUpdate } = options

        track.resolver = undefined

        /**
         * If we can't animate this value with the resolved keyframes
         * then we should complete it immediately.
         */
        if (!canAnimate(keyframes, name, type, velocity)) {
            if (MotionGlobalConfig.instantAnimations || !delay) {
                const final = getFinalKeyframe(keyframes, options, finalKeyframe)
                track.value.set(final)
                onUpdate?.(final)
            }

            keyframes[0] = keyframes[keyframes.length - 1]

            makeAnimationInstant(options)
            options.repeat = 0
        }

        options.finalKeyframe = finalKeyframe
        options.keyframes = keyframes

        Object.assign(track, createTrack(options))

        if (!--this.pendingResolvers) this.start()
    }

    /**
     * The number of values in the pool.
     */
    get size() {
        return this.tracks.length
    }

    private start() {
        const { tracks, owner } = this
        const now = time.now()

        let startTime: number | undefined
        const byProperty = new Map<string, PoolTrack[]>()

        for (const track of tracks) {
            const { options } = track
            startTime ??= options.startTime
            notifyAnimationStart(this, options)

            if (
                options.duration !== 0 &&
                options.autoplay !== false &&
                canAccelerate(track, owner)
            ) {
                const property = getChannelProperty(track.key)
                const group = byProperty.get(property)
                group ? group.push(track) : byProperty.set(property, [track])
            }
        }

        /**
         * A pool with accelerated values starts from a fixed time, so the
         * main thread and the compositor agree. One that is all on the main
         * thread confirms its start time on its first frame, as a
         * JSAnimation does, so it never starts before it can render.
         */
        this.startTime = startTime ?? resolveStartTime(this.createdAt, now)
        if (startTime === undefined && !byProperty.size) {
            this.pendingStartTime = this.startTime
        }

        this.state = "running"

        this.allocate(byProperty)

        if (this.pendingTimeline) {
            this.attachTimeline(this.pendingTimeline)
            this.pendingTimeline = undefined
        }

        if (tracks[0]?.options.autoplay === false) this.pause()
    }

    /**
     * Hand each property's tracks to its channel, and tick the rest.
     */
    private allocate(byProperty: Map<string, PoolTrack[]>) {
        const { tracks, owner } = this

        byProperty.forEach((group) => {
            if (claimChannel(this, owner!, group)) {
                this.channels.add(group[0].channel!)
                group.forEach((track) => (track.isJS = false))
            }
        })

        for (const track of tracks) {
            track.options.onPlay?.()

            if (track.isJS && !track.done && !track.released) {
                this.jsTracks.push(track)
                if (owner && hasChannel(track.key)) {
                    track.blocking = blockChannel(owner, track.key)
                }
            }
        }

        this.jsTracks.length && this.startDriver()
    }

    private startDriver() {
        const driver =
            this.tracks.find((track) => track.options.driver)?.options
                .driver || frameloopDriver
        this.driver ||= driver((timestamp) => this.tick(timestamp))
        this.driver.start()
    }

    /**
     * The pool's time in ms at `timestamp`, from its clock.
     */
    private timeAt(timestamp: number) {
        return this.holdTime ?? (timestamp - this.startTime!) * this.playbackSpeed
    }

    get currentTime() {
        return this.startTime === null
            ? 0
            : Math.max(0, this.timeAt(time.now()))
    }

    private output(track: PoolTrack, value: AnyResolvedKeyframe) {
        track.value.set(value)
        track.options.onUpdate?.(value)
    }

    private tick(timestamp: number) {
        if (this.startTime === null) return

        if (this.startTime === this.pendingStartTime) {
            this.startTime = resolveStartTime(this.startTime, timestamp)
        }
        this.pendingStartTime = undefined

        /**
         * requestAnimationFrame timestamps can come through as lower than
         * the startTime as set by performance.now(). Here we prevent this
         * for main-thread pools. Accelerated pools keep their start time
         * so the compositor and the main thread stay in step.
         */
        if (!this.channels.size && this.holdTime === null) {
            if (this.playbackSpeed > 0) {
                this.startTime = Math.min(this.startTime, timestamp)
            }
        }

        const isHeld = this.holdTime !== null
        const isFinished = this.state === "finished"
        const currentTime = this.timeAt(timestamp)
        const { jsTracks } = this

        let numDone = 0
        for (let i = 0; i < jsTracks.length; i++) {
            const track = jsTracks[i]
            const sample = sampleTrack(
                track,
                currentTime,
                this.playbackSpeed,
                isFinished && !isHeld
            )
            const done =
                !isHeld &&
                (isFinished || (this.state === "running" && sample.done))

            this.output(
                track,
                done && !isInertia(track)
                    ? getTrackEnd(track, this.playbackSpeed)
                    : sample.value
            )

            if (done) {
                track.done = true
                numDone++
            }
        }

        if (numDone) {
            for (const track of jsTracks.filter((t) => t.done)) {
                this.completeTrack(track)
            }
        }
    }

    private completeTrack(track: PoolTrack) {
        track.done = true
        track.channel = undefined
        this.unblock(track)
        this.removeJS(track)

        track.complete()
        track.options.onComplete?.()
        track.handle.finish()

        if (!--this.active) this.finish()
    }

    private unblock(track: PoolTrack) {
        if (track.blocking) {
            track.blocking.blockers--
            track.blocking = undefined
        }
    }

    private removeJS(track: PoolTrack) {
        const { jsTracks } = this
        const index = jsTracks.indexOf(track)
        index > -1 && jsTracks.splice(index, 1)
    }

    /**
     * Every track has finished. Interrupted values keep their promise
     * pending, as they always have, so the pool only resolves when none
     * were released.
     */
    private finish() {
        this.teardown()
        if (this.wasReleased) return
        this.state = "finished"
        this.notifyFinished()
    }

    private teardown() {
        this.state = "idle"
        this.driver?.stop()
        this.startTime = this.holdTime = null
    }

    /**
     * Called by channels when their animation finishes.
     */
    completeTracks(tracks: PoolTrack[]) {
        for (const track of [...tracks]) {
            if (track.done || track.released) continue
            this.output(track, getTrackEnd(track, this.playbackSpeed))
            this.completeTrack(track)
        }
    }

    /**
     * Called by channels: these tracks continue on the main thread from
     * the same time.
     */
    demote(tracks: PoolTrack[]) {
        const currentTime = this.currentTime

        for (const track of tracks) {
            const { channel } = track
            this.channels.delete(channel!)
            track.channel = undefined
            track.isJS = true
            track.blocking = channel
            this.output(
                track,
                sampleTrack(track, currentTime, this.playbackSpeed).value
            )
            this.jsTracks.push(track)
        }

        this.state === "running" && this.startDriver()
    }

    /**
     * Write a track's current value, and velocity, to its motion value.
     */
    private sync(track: PoolTrack) {
        const now = time.now()
        const { value } = track

        if (track.channel) {
            const currentTime = this.timeAt(now)
            const current = sampleTrack(
                track,
                currentTime,
                this.playbackSpeed
            ).value
            const prev = sampleTrack(
                track,
                currentTime - velocityDelta * this.playbackSpeed,
                this.playbackSpeed
            ).value
            value.setWithVelocity(prev, current, velocityDelta)
        } else if (value.updatedAt !== now && this.startTime !== null) {
            this.output(
                track,
                sampleTrack(track, this.timeAt(now), this.playbackSpeed).value
            )
        }
    }

    /**
     * Release a value from the pool, e.g. because another animation has
     * taken it over.
     */
    release(track: PoolTrack) {
        if (track.done || track.released) return

        track.released = true
        this.wasReleased = true

        if (track.resolver) {
            track.resolver.cancel()
            track.resolver = undefined
            this.pendingResolvers--
        } else {
            this.sync(track)

            if (track.channel) {
                const { channel } = track
                releaseFromChannel(track)
                channel.tracks.length || this.channels.delete(channel)
            } else {
                this.removeJS(track)
            }
        }

        this.unblock(track)
        if (track.value.animation === track.handle) {
            track.value.animation = undefined
        }
        track.options.onStop?.()

        if (!--this.active) this.teardown()
    }

    /**
     * Controls act on resolved tracks, so if keyframes are still being
     * resolved, resolve them now.
     */
    private ensureResolved() {
        this.pendingResolvers && flushKeyframeResolvers()
    }

    /**
     * Write every main-thread value at a time, e.g. after a seek. Tracks on
     * channels are already there.
     */
    private seek(currentTime: number) {
        for (const track of this.tracks) {
            if (!track.released && !track.channel && track.generator) {
                this.output(
                    track,
                    sampleTrack(track, currentTime, this.playbackSpeed).value
                )
            }
        }
    }

    get duration() {
        this.ensureResolved()
        let max = 0
        for (const track of this.tracks) {
            max = Math.max(max, track.calculatedDuration || 0)
        }
        return millisecondsToSeconds(max)
    }

    get iterationDuration() {
        this.ensureResolved()
        let max = 0
        for (const track of this.tracks) {
            max = Math.max(
                max,
                (track.options.delay || 0) + (track.calculatedDuration || 0)
            )
        }
        return millisecondsToSeconds(max)
    }

    get time() {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        this.ensureResolved()

        newTime = secondsToMilliseconds(newTime)
        const now = time.now()

        if (
            this.startTime === null ||
            this.holdTime !== null ||
            this.playbackSpeed === 0
        ) {
            this.holdTime = newTime
            this.startTime ??= now
        } else {
            this.startTime = now - newTime / this.playbackSpeed
        }

        this.channels.forEach(syncChannel)
        this.seek(this.currentTime)
    }

    get speed() {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        if (this.playbackSpeed === newSpeed) return

        this.ensureResolved()

        /**
         * A pool that isn't running (finished, cancelled or stopped) has no
         * time to re-anchor; its next play() starts from the right end.
         */
        if (this.startTime === null) {
            this.playbackSpeed = newSpeed
            return
        }

        const currentTime = this.currentTime
        this.playbackSpeed = newSpeed
        this.time = millisecondsToSeconds(currentTime)
    }

    play() {
        if (this.isStopped) return

        this.ensureResolved()

        const now = time.now()

        if (this.state === "finished") {
            this.updateFinished()
            this.restart(now)
        } else if (this.state === "idle") {
            // Cancelled: play from the start again
            this.restart(now)
        } else if (this.holdTime !== null) {
            this.startTime = now - this.holdTime / this.playbackSpeed
            this.holdTime = null
            this.state = "running"
            this.channels.forEach(syncChannel)
            this.jsTracks.length && this.startDriver()
        }
    }

    /**
     * Play again from the start (or the end, in reverse).
     */
    private restart(now: number) {
        const { tracks, owner } = this
        const byProperty = new Map<string, PoolTrack[]>()

        this.jsTracks.length = 0
        this.active = 0

        for (const track of tracks) {
            if (track.released) continue
            track.done = false
            track.isJS = true
            track.channel = undefined
            this.active++
            if (canAccelerate(track, owner)) {
                const property = getChannelProperty(track.key)
                const group = byProperty.get(property)
                group ? group.push(track) : byProperty.set(property, [track])
            }
        }

        if (!this.active) return

        this.startTime =
            this.playbackSpeed < 0 ? now - this.end / this.playbackSpeed : now
        this.holdTime = null
        this.state = "running"
        this.allocate(byProperty)
    }

    pause() {
        this.ensureResolved()
        if (this.state !== "running") return
        this.holdTime = this.currentTime
        this.state = "paused"
        this.channels.forEach(syncChannel)
    }

    complete() {
        if (this.state !== "running") this.play()

        this.state = "finished"
        this.holdTime = null

        this.channels.forEach(completeChannel)
        this.channels.clear()

        for (const track of [...this.jsTracks]) {
            this.output(track, getTrackEnd(track, this.playbackSpeed))
            this.completeTrack(track)
        }
    }

    /**
     * Bound to support the `return animation.stop` pattern.
     */
    stop = () => {
        if (this.isStopped) return
        this.isStopped = true

        for (const track of this.tracks) this.release(track)
        this.teardown()
    }

    /**
     * Return every value to its start and stop, keeping the values so the
     * pool can play again.
     */
    cancel() {
        this.ensureResolved()

        /**
         * Detach tracks from their channels first so the values read as
         * written, then the channels write those values inline as they
         * cancel.
         */
        for (const track of this.tracks) {
            if (track.done || track.released) continue
            track.channel = undefined
            this.unblock(track)
            this.output(track, sampleTrack(track, 0, 1).value)
            track.options.onCancel?.()
        }

        this.channels.forEach(windDownChannel)
        this.channels.clear()

        this.jsTracks.length = 0
        this.teardown()
    }

    /**
     * Drive the pool from a timeline. Channels attach to a native scroll
     * timeline where there is one, and leave the pool's control; the
     * rest run on the main thread from the timeline's progress.
     */
    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        if (this.state === "idle" && this.pendingResolvers) {
            this.pendingTimeline = timeline
            return () => this.stop()
        }

        for (const track of this.tracks) {
            if (track.options.allowFlatten) {
                track.options.type = "keyframes"
                track.options.ease = "linear"
                Object.assign(track, createTrack(track.options))
            }
        }

        if (timeline.timeline && supportsScrollTimeline()) {
            this.channels.forEach((channel) => {
                const { animation, tracks } = channel
                if (!animation) return

                if (tracks.some((track) => track.options.allowFlatten)) {
                    animation.effect?.updateTiming({ easing: "linear" })
                }

                animation.onfinish = null
                animation.timeline = timeline.timeline as any
                timeline.onAttach?.(animation)
                this.channels.delete(channel)
            })
        } else {
            this.channels.forEach(demoteChannel)
        }

        this.driver?.stop()

        return this.jsTracks.length ? timeline.observe(this) : noop<void>
    }

    /**
     * When the pool stops moving: the end of its longest track.
     */
    get end() {
        let max = 0
        for (const track of this.tracks) max = Math.max(max, trackEnd(track))
        return max
    }
}
