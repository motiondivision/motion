import { millisecondsToSeconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { flushKeyframeResolvers } from "./keyframes/KeyframesResolver"
import { getFinalKeyframe } from "./keyframes/get-final"
import { inertia } from "./generators/inertia"
import { JSAnimation } from "./JSAnimation"
import { generateTrack, initTrack, Track } from "./track"
import {
    AnimationPlaybackControls,
    AnimationPlaybackControlsWithThen,
    AnimationState,
    AnyResolvedKeyframe,
    KeyframeGenerator,
    Lane,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { Driver } from "./drivers/types"
import { resolveStartTime } from "./utils/resolve-start-time"
import { notifyAnimationStart } from "./utils/notify-inspector"
import { WithPromise } from "./utils/WithPromise"
import { Mixer } from "../utils/mix/types"

/**
 * One value of a Clip. It's the value's animation (what the motion value
 * holds and stops) and keeps what it takes to sample the value at the
 * clip's time. It has no clock of its own. Controlled on its own, it hands
 * itself to a JSAnimation that takes the clip's time with it.
 */
export class ClipTrack<T extends AnyResolvedKeyframe = any>
    extends WithPromise
    implements Track<T>, AnimationPlaybackControlsWithThen
{
    generator!: KeyframeGenerator<T>
    mirroredGenerator: KeyframeGenerator<T> | undefined
    mixKeyframes: Mixer<T> | undefined
    calculatedDuration = 0
    resolvedDuration = 0
    totalDuration = 0
    delayState?: AnimationState<T>
    lane?: Lane

    isDone = false
    isStopped = false

    /**
     * The animation this value moved to when controlled on its own.
     */
    detached?: JSAnimation<any>

    /**
     * Reads this value's keyframes from its subject, until they're read.
     */
    resolver?: { cancel(): void }

    constructor(public clip: Clip, public options: ValueAnimationOptions<T>) {
        super()
    }

    get isReady() {
        return !!this.generator
    }

    /**
     * Keyframes are resolved: work out the generator and durations.
     */
    init() {
        this.resolver = undefined
        if (this.isStopped) return
        initTrack(this)
        notifyAnimationStart(this, this.options)
        this.clip.onTrackReady(this)
    }

    /**
     * What a group of animations holds for this value: the clip, while
     * the value plays in it.
     */
    get grouped(): AnimationPlaybackControls {
        return this.detached || this.clip
    }

    finish(onComplete = this.options.onComplete) {
        this.isDone = true
        this.notifyFinished()
        onComplete?.()
    }

    revive() {
        if (this.isDone) {
            this.isDone = false
            this.updateFinished()
        }
    }

    /**
     * Interrupted by another animation of the same value.
     */
    stop = () => {
        if (this.detached) return this.detached.stop()
        if (this.isStopped) return
        this.isStopped = true
        this.resolver?.cancel()
        this.clip.removeTrack(this)
    }

    /**
     * Control this value alone: in a clip of its own, that's the clip.
     * Otherwise it moves to a JSAnimation at the clip's time.
     */
    private get own(): AnimationPlaybackControls {
        if (this.detached) return this.detached
        if (this.clip.numLive() <= 1) return this.clip
        return this.clip.detach(this)
    }

    get duration() {
        this.isReady || flushKeyframeResolvers()
        return millisecondsToSeconds(this.calculatedDuration)
    }

    get iterationDuration() {
        return this.duration + millisecondsToSeconds(this.options.delay || 0)
    }

    get state() {
        return this.detached
            ? this.detached.state
            : this.isDone
            ? "finished"
            : this.clip.state
    }

    get startTime() {
        return (this.detached || this.clip).startTime
    }

    get time() {
        return (this.detached || this.clip).time
    }

    set time(newTime: number) {
        this.own.time = newTime
    }

    get speed() {
        return (this.detached || this.clip).speed
    }

    set speed(newSpeed: number) {
        this.own.speed = newSpeed
    }

    play() {
        this.own.play()
    }

    pause() {
        this.own.pause()
    }

    complete() {
        this.own.complete()
    }

    cancel() {
        this.own.cancel()
    }

    attachTimeline(timeline: TimelineWithFallback) {
        return this.own.attachTimeline(timeline)
    }
}

/**
 * Many values animated on one clock, as one animate() call makes them.
 * Time, speed and playback are kept once, and each frame is one loop over
 * the values rather than one animation each. Each value is sampled as a
 * JSAnimation of its own would be.
 */
export class Clip extends JSAnimation<any> {
    tracks: ClipTrack[] = []

    /**
     * Tracks still waiting on their keyframes.
     */
    private numPending = 0

    /**
     * A stopped track's animation never finishes, so neither does the
     * clip's, as with a group of animations.
     */
    private isInterrupted = false

    private hasStoppedTracks = false

    constructor(driver?: Driver) {
        super({ keyframes: [0, 1], driver } as any, true)
        this.calculatedDuration = this.totalDuration = 0
    }

    /**
     * Add a value. Its track joins the clock once init() is called with
     * its keyframes resolved.
     */
    add<T extends AnyResolvedKeyframe>(options: ValueAnimationOptions<T>) {
        const track = new ClipTrack<T>(this, options)
        this.tracks.push(track)
        this.numPending++
        return track
    }

    onTrackReady(track: ClipTrack) {
        this.numPending--
        const { calculatedDuration, totalDuration, options } = track

        if (calculatedDuration > this.calculatedDuration) {
            this.calculatedDuration = calculatedDuration
        }

        const end = totalDuration + (options.delay || 0)
        if (end > this.totalDuration) this.totalDuration = end
    }

    /**
     * Start the clock, once every value is added.
     */
    start() {
        this.begin()
    }

    initAnimation() {}

    protected begin() {
        this.play()
        if (this.options.autoplay === false) this.pause()
    }

    numLive() {
        let n = 0
        for (const track of this.tracks) {
            if (!track.isStopped && !track.detached) n++
        }
        return n
    }

    get duration() {
        this.numPending && flushKeyframeResolvers()
        return millisecondsToSeconds(this.calculatedDuration)
    }

    get iterationDuration() {
        this.numPending && flushKeyframeResolvers()
        let max = 0
        for (const track of this.tracks) {
            const d = track.calculatedDuration + (track.options.delay || 0)
            if (d > max) max = d
        }
        return millisecondsToSeconds(max)
    }

    step(timestamp: number) {
        this.tick(timestamp)
    }

    tick(timestamp: number, sample = false): AnimationState<any> {
        if (this.startTime === null) return undefined as any

        if (this.startTime === this.pendingStartTime) {
            this.startTime = resolveStartTime(this.startTime, timestamp)
        }
        this.pendingStartTime = undefined

        const speed = this.playbackSpeed
        const { holdTime, totalDuration, tracks } = this

        if (speed > 0) {
            this.startTime = Math.min(this.startTime, timestamp)
        } else if (speed < 0) {
            this.startTime = Math.min(
                timestamp - totalDuration / speed,
                this.startTime
            )
        }

        sample ? (this.currentTime = timestamp) : this.updateTime(timestamp)

        const clockTime = this.currentTime
        const isForwards = speed >= 0
        const isFinished = this.state === "finished" && holdTime === null
        const isRunning = this.state === "running" && holdTime === null
        let numActive = this.numPending
        let reportedTime: number | undefined

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i]
            if (track.isDone || track.isStopped || track.detached) continue
            if (!track.generator) continue

            const { options } = track
            const delay = options.delay || 0
            const trackDuration = track.totalDuration

            const timeWithoutDelay = clockTime - (isForwards ? delay : -delay)
            const isInDelayPhase = isForwards
                ? timeWithoutDelay < 0
                : timeWithoutDelay > trackDuration
            const t = isFinished ? trackDuration : Math.max(timeWithoutDelay, 0)

            reportedTime ??= t

            let value: any
            let done: boolean
            const { lane } = track

            if (
                lane &&
                !isInDelayPhase &&
                !isFinished &&
                t > lane.start &&
                t < lane.end
            ) {
                value =
                    lane.from +
                    lane.delta *
                        lane.ease((t - lane.start) / (lane.end - lane.start))
                done = false
            } else {
                const state = generateTrack(track, t, isInDelayPhase)
                value = state.value
                done = isInDelayPhase
                    ? false
                    : isForwards
                    ? track.calculatedDuration < Infinity
                        ? t >= trackDuration
                        : state.done
                    : t <= 0
            }

            const isTrackFinished = isFinished || (isRunning && done)

            if (isTrackFinished && options.type !== inertia) {
                value = getFinalKeyframe(
                    options.keyframes,
                    options,
                    (options as any).finalKeyframe,
                    speed
                )
            }

            options.onUpdate?.(value)

            if (isTrackFinished) {
                track.finish()
            } else {
                numActive++
            }
        }

        if (reportedTime !== undefined) this.currentTime = reportedTime

        if (this.hasStoppedTracks) {
            this.hasStoppedTracks = false
            this.tracks = tracks.filter((track) => !track.isStopped)
        }

        if (!numActive && (isRunning || isFinished)) this.finish()

        return undefined as any
    }

    finish() {
        this.isInterrupted || this.notifyFinished()
        this.teardown()
        this.state = "finished"
    }

    /**
     * Revive values that finished, as a group of animations does when
     * it's played or seeked again.
     */
    private revive() {
        for (const track of this.tracks) track.revive()
    }

    play() {
        if (this.isStopped) return
        if (this.state === "finished") this.revive()
        super.play()
    }

    get time() {
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        this.revive()
        setTime.call(this, newTime)
    }

    get speed() {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        /**
         * Played backwards, values reverse from the end of their own
         * animation. With one end for every value, that's the clip's.
         */
        if (newSpeed < 0 && !this.hasOneEnd()) {
            this.detachAll()
        }
        setSpeed.call(this, newSpeed)
    }

    private hasOneEnd() {
        let end: number | undefined
        for (const track of this.tracks) {
            if (track.isStopped || track.detached) continue
            if (!track.isReady) flushKeyframeResolvers()
            end ??= track.totalDuration
            if (track.totalDuration !== end) return false
        }
        return true
    }

    protected stopAnimation() {
        /**
         * Values not yet set this frame are caught up to now, as a
         * JSAnimation is when stopped.
         */
        if (this.state === "running" && this.startTime !== null) {
            const now = time.now()
            for (const track of this.tracks) {
                const value = track.options.motionValue
                track.isReady &&
                    !track.isDone &&
                    !track.isStopped &&
                    !track.detached &&
                    value &&
                    value.updatedAt !== now &&
                    this.sampleTrack(track, now)
            }
        }

        this.isStopped = true
        for (const track of this.tracks) track.detached?.stop()
        if (this.state === "idle") return
        this.teardown()
    }

    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        const animations = this.detachAll()
        const cancels = animations.map((animation) =>
            animation.attachTimeline(timeline)
        )
        return () => cancels.forEach((cancel) => cancel())
    }

    /**
     * A track stopped by another animation of its value. It's sampled
     * now, as a JSAnimation is when stopped, so the value and its
     * velocity are current.
     */
    removeTrack(track: ClipTrack) {
        const value = track.options.motionValue
        track.isReady &&
            !track.isDone &&
            this.state === "running" &&
            this.startTime !== null &&
            value &&
            value.updatedAt !== time.now() &&
            this.sampleTrack(track, time.now())

        if (!track.isReady) this.numPending--

        this.isInterrupted = this.hasStoppedTracks = true

        if (!this.numLive() && this.numPending <= 0) this.teardown()
    }

    private sampleTrack(track: ClipTrack, timestamp: number) {
        const delay = track.options.delay || 0
        const t = this.at(timestamp) - delay
        const state = generateTrack(track, Math.max(t, 0), t < 0)
        track.options.onUpdate?.(state.value)
    }

    /**
     * Move a track to a JSAnimation of its own, at the clip's time and
     * playback state.
     */
    detach(track: ClipTrack): JSAnimation<any> {
        if (track.detached) return track.detached

        track.isReady || flushKeyframeResolvers()

        const { onComplete } = track.options
        const animation = new JSAnimation(
            {
                ...track.options,
                onComplete: () => track.finish(onComplete),
            },
            true
        )
        animation.initAnimation()

        const { state, startTime, holdTime, playbackSpeed } = this
        animation.speed = playbackSpeed

        if (track.isDone) {
            animation.state = "finished"
        } else if (state === "running" && startTime !== null) {
            animation.startTime = startTime
            animation.play()
        } else if (state === "paused" || state === "running") {
            animation.time = millisecondsToSeconds(holdTime ?? this.currentTime)
        }

        track.detached = animation
        this.isInterrupted = true

        if (!this.numLive() && this.numPending <= 0) this.teardown()

        return animation
    }

    private detachAll() {
        this.numPending && flushKeyframeResolvers()
        const animations: JSAnimation<any>[] = []
        for (const track of this.tracks) {
            if (!track.isStopped) animations.push(this.detach(track))
        }

        /**
         * Anything waiting on the clip's promise now waits on the
         * animations that took its values.
         */
        Promise.all(animations.map((a) => a.finished)).then(() =>
            this.notifyFinished()
        )
        this.isInterrupted = true

        const clip = this
        Object.defineProperties(this, {
            state: {
                get: () => animations[0]?.state ?? "finished",
                set() {},
            },
            startTime: {
                get: () => animations[0]?.startTime ?? null,
                set() {},
            },
        })
        Object.assign(this, {
            play: () => animations.forEach((a) => a.play()),
            pause: () => animations.forEach((a) => a.pause()),
            complete: () => animations.forEach((a) => a.complete()),
            cancel: () => animations.forEach((a) => a.cancel()),
            stop: () => animations.forEach((a) => a.stop()),
        })
        Object.defineProperty(this, "time", {
            get: () => animations[0]?.time ?? 0,
            set: (t: number) => animations.forEach((a) => (a.time = t)),
        })
        Object.defineProperty(this, "speed", {
            get: () => animations[0]?.speed ?? clip.playbackSpeed,
            set: (s: number) => animations.forEach((a) => (a.speed = s)),
        })

        return animations
    }
}

const jsAnimationProto = JSAnimation.prototype
const setTime = Object.getOwnPropertyDescriptor(jsAnimationProto, "time")!.set!
const setSpeed = Object.getOwnPropertyDescriptor(jsAnimationProto, "speed")!
    .set!
