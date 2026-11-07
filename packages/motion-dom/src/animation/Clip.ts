import { millisecondsToSeconds, secondsToMilliseconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { setStyle } from "../render/dom/style-set"
import { supportsScrollTimeline } from "../utils/supports/scroll-timeline"
import { sampleDelta } from "./NativeAnimationExtended"
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
import type { MotionValue } from "../value"
import type { ClipPlan } from "./animate/clip-value"

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
    detached?: AnimationPlaybackControlsWithThen

    /**
     * Reads this value's keyframes from its subject, until they're read.
     */
    resolver?: { cancel(): void }

    /**
     * The WAAPI animation playing this value, controlled by the clip with
     * the others it pools. The track still samples the value when it's
     * read or interrupted.
     */
    native?: Animation

    /**
     * On WAAPI, following a native scroll timeline.
     */
    isScrolling?: boolean

    constructor(
        public clip: Clip,
        public options: ValueAnimationOptions<T>,
        public value: MotionValue<T>,
        public plan: ClipPlan,
        private onDone: VoidFunction
    ) {
        super()
    }

    /**
     * Set the value, and call the transition's onUpdate.
     */
    update(latest: T) {
        this.value.set(latest)
        this.plan.transition.onUpdate?.(latest)
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
        return this.clip
    }

    finish() {
        this.isDone = true
        this.notifyFinished()
        this.onDone()
        this.plan.transition.onComplete?.()
        ;(this.detached || this.native) && this.clip.check()
    }

    /**
     * The value now, while WAAPI plays it and doesn't set it.
     */
    liveValue() {
        return this.native && !this.isDone
            ? this.clip.valueAt(this, time.now())
            : undefined
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
        if (this.isStopped) return
        this.isStopped = true
        if (this.detached) {
            this.detached.stop()
            this.clip.interrupt()
        } else {
            this.resolver?.cancel()
            this.clip.removeTrack(this)
        }
    }

    /**
     * Control this value alone: in a clip of its own, that's the clip.
     * Otherwise it moves to a JSAnimation at the clip's time.
     */
    private get own(): AnimationPlaybackControls {
        const { clip } = this
        return clip.tracks.length > 1 || this.detached
            ? clip.detach(this)
            : clip
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

    /**
     * Once every value has moved to an animation of its own, the clip
     * reads its state from the first.
     */
    private lead?: AnimationPlaybackControlsWithThen

    private hasStarted = false

    constructor(driver?: Driver) {
        super({ keyframes: [0, 1], driver } as any, true)
        this.calculatedDuration = this.totalDuration = 0
    }

    /**
     * Add a value. Its track joins the clock once init() is called with
     * its keyframes resolved.
     */
    add<T extends AnyResolvedKeyframe>(
        options: ValueAnimationOptions<T>,
        value: MotionValue<T>,
        plan: ClipPlan,
        onComplete: VoidFunction
    ) {
        const track = new ClipTrack<T>(this, options, value, plan, onComplete)
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
        this.hasStarted = true
        this.settle()
        this.begin()
    }

    initAnimation() {}

    /**
     * Values on animations of their own started them already.
     */
    protected begin() {
        if (this.lead) return
        super.play()
        this.options.autoplay === false && super.pause()
        this.natives((native) => this.syncNative(native))
    }

    /**
     * Play a track on WAAPI, pooled with the clip's other WAAPI values:
     * the clip controls each one directly, with timing worked out once
     * for the plan.
     */
    pool(
        track: ClipTrack,
        element: Element,
        [timing, easing]: [KeyframeAnimationOptions, string[] | undefined]
    ) {
        const { name, keyframes, times, delay } = track.options
        const frames: PropertyIndexedKeyframes = { [name!]: keyframes as any }
        if (times) frames.offset = times
        if (easing) frames.easing = easing

        const native = (track.native = element.animate(frames, {
            ...timing,
            delay,
        }))
        ;(native as any).track = track
        ;(native as any).el = element
        native.onfinish = onNativeFinish
        this.syncNative(native)
    }

    /**
     * Start a WAAPI animation from the clip's start time and state.
     */
    private syncNative(native: Animation) {
        const { startTime, state } = this
        if (startTime === null) return
        if (state === "paused") {
            native.pause()
            native.currentTime = this.holdTime ?? 0
        } else {
            native.startTime = resolveStartTime(startTime, time.now())
        }
    }

    /**
     * Apply a control to the tracks on WAAPI.
     */
    private natives(control: (native: Animation) => void) {
        for (const { native, isStopped } of this.tracks) {
            native && !isStopped && control(native)
        }
    }

    /**
     * A track's value at a timestamp, from the clip's time.
     */
    valueAt(track: ClipTrack, timestamp: number) {
        const t = this.at(timestamp) - (track.options.delay || 0)
        return generateTrack(track, Math.max(t, 0), t < 0).value
    }

    /**
     * Take a track off WAAPI, leaving its value, with velocity, and the
     * style where it was.
     */
    private release(track: ClipTrack) {
        const native = track.native!
        track.native = undefined
        native.onfinish = null

        if (!track.isDone && this.startTime !== null) {
            const now = time.now()
            const speed = this.playbackSpeed
            const delta = this.state === "running" && speed ? sampleDelta : 0
            const current = this.valueAt(track, now)
            setStyle((native as any).el, track.options.name!, current)
            track.value.setWithVelocity(
                this.valueAt(track, now - delta * Math.sign(speed)),
                current,
                delta / Math.abs(speed || 1)
            )
        }

        native.cancel()
    }

    /**
     * Tracks that left the clock: stopped, or on an animation of their
     * own.
     */
    private numOut = 0

    numLive() {
        return this.tracks.length - this.numOut
    }

    get duration() {
        this.numPending && flushKeyframeResolvers()
        return millisecondsToSeconds(this.calculatedDuration)
    }

    get iterationDuration() {
        this.numPending && flushKeyframeResolvers()
        let max = 0
        for (const { detached, calculatedDuration, options } of this.tracks) {
            const d = detached
                ? detached.iterationDuration
                : millisecondsToSeconds(calculatedDuration + (options.delay || 0))
            if (d > max) max = d
        }
        return max
    }

    /**
     * A clip of one value hands its blend to the driver, as a
     * JSAnimation does.
     */
    step(timestamp: number) {
        const { tracks } = this
        const track = tracks.length === 1 && tracks[0]
        ;(track &&
            track.isReady &&
            !track.isDone &&
            this.numLive() &&
            this.handLane(timestamp, track, (v) => track.update(v))) ||
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
        let hasTime = false

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

            /**
             * The clip reports its first value's time. It's set before
             * any value updates, so a seek from an update stands.
             */
            if (!hasTime) {
                hasTime = true
                this.currentTime = t
            }

            /**
             * WAAPI plays it, and finishes it.
             */
            if (track.native) {
                numActive++
                continue
            }

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

            track.update(value)

            if (isTrackFinished) {
                track.finish()
            } else {
                numActive++
            }
        }

        if (this.hasStoppedTracks) {
            this.hasStoppedTracks = false
            this.tracks = tracks.filter((track) => !track.isStopped)
            this.numOut -= tracks.length - this.tracks.length
        }

        if (!numActive && (isRunning || isFinished)) this.finish()

        return undefined as any
    }

    finish() {
        this.teardown()
        this.state = "finished"
        this.check()
    }

    /**
     * The clip's animation finishes once every value's has, unless one
     * was stopped, as with a group of animations.
     */
    check() {
        this.isInterrupted ||
            this.tracks.some((track) => !track.isDone) ||
            this.notifyFinished()
    }

    /**
     * Apply a control to the values on animations of their own.
     */
    private each(control: (a: AnimationPlaybackControlsWithThen) => void) {
        for (const { detached, isStopped } of this.tracks) {
            detached && !isStopped && control(detached)
        }
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
        this.lead || super.play()
        this.each((a) => a.play())
        this.natives((native) => {
            native.onfinish = onNativeFinish
            native.play()
        })
    }

    pause() {
        this.lead || super.pause()
        this.each((a) => a.pause())
        this.natives((native) => {
            native.pause()
            native.currentTime = this.holdTime ?? native.currentTime
        })
    }

    complete() {
        this.lead || super.complete()
        this.each((a) => a.complete())
        this.natives((native) => native.finish())
    }

    cancel() {
        this.lead || super.cancel()
        this.each((a) => a.cancel())
        this.natives((native) => {
            native.onfinish = null
            native.cancel()
        })
    }

    get time() {
        return this.lead ? this.lead.time : millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        this.revive()
        this.lead || setTime.call(this, newTime)
        this.each((a) => (a.time = newTime))
        this.natives((native) => {
            native.onfinish = onNativeFinish
            native.currentTime = secondsToMilliseconds(newTime)
            this.holdTime === null && native.play()
        })
    }

    get speed() {
        return this.lead ? this.lead.speed : this.playbackSpeed
    }

    set speed(newSpeed: number) {
        /**
         * Played backwards, values reverse from the end of their own
         * animation. With one end for every value, that's the clip's.
         */
        newSpeed < 0 && !this.hasOneEnd() && this.detachLive()
        this.lead || setSpeed.call(this, newSpeed)
        this.each((a) => (a.speed = newSpeed))
        this.natives((native) => (native.playbackRate = newSpeed))
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
        for (const track of this.tracks) {
            track.isStopped ||
                track.detached ||
                (track.native ? this.release(track) : this.catchUp(track))
        }

        this.isStopped = true
        for (const track of this.tracks) track.detached?.stop()
        if (this.state === "idle") return
        this.teardown()
    }

    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        /**
         * WAAPI values follow a native scroll timeline. Without one, they
         * follow it from JS, like the rest.
         */
        if (timeline.timeline && supportsScrollTimeline()) {
            this.natives((native) => {
                const { track } = native as any
                track.plan.base.allowFlatten &&
                    native.effect?.updateTiming({ easing: "linear" })
                native.onfinish = null
                native.timeline = timeline.timeline as any
                track.isScrolling = true
                timeline.onAttach?.(native)
            })
        }
        this.detachLive()
        const cancels: VoidFunction[] = []
        this.each((a) => cancels.push(a.attachTimeline(timeline)))
        return () => cancels.forEach((cancel) => cancel())
    }

    /**
     * A track stopped by another animation of its value. It's sampled
     * now, as a JSAnimation is when stopped, so the value and its
     * velocity are current.
     */
    removeTrack(track: ClipTrack) {
        track.native ? this.release(track) : this.catchUp(track)

        if (!track.isReady) this.numPending--

        this.isInterrupted = this.hasStoppedTracks = true
        this.numOut++

        if (!this.numLive() && this.numPending <= 0) this.teardown()
    }

    /**
     * Set a track's value to now, or to where it's held, unless it's
     * already been set this frame, as a JSAnimation is when stopped.
     */
    private catchUp(track: ClipTrack) {
        const now = time.now()
        if (
            track.isReady &&
            !track.isDone &&
            this.startTime !== null &&
            track.value.updatedAt !== now
        ) {
            const t = this.at(now) - (track.options.delay || 0)
            track.update(generateTrack(track, Math.max(t, 0), t < 0).value)
        }
    }

    /**
     * Move a track to an animation of its own: the one given, or a
     * JSAnimation at the clip's time and playback state.
     */
    detach(
        track: ClipTrack,
        animation?: AnimationPlaybackControlsWithThen
    ): AnimationPlaybackControlsWithThen {
        if (track.detached) return track.detached

        track.native && this.release(track)

        if (animation) {
            track.resolver = undefined
            this.numPending--
        } else {
            track.isReady || flushKeyframeResolvers()

            const js = (animation = new JSAnimation(
                {
                    ...track.options,
                    onUpdate: (latest: any) => track.update(latest),
                    onComplete: () => track.finish(),
                },
                true
            ))
            js.initAnimation()

            const { state, startTime, holdTime, playbackSpeed } = this
            js.speed = playbackSpeed

            if (track.isDone) {
                js.state = "finished"
            } else if (state === "running" && startTime !== null) {
                js.startTime = startTime
                js.play()
            } else if (state === "paused" || state === "running") {
                js.time = millisecondsToSeconds(holdTime ?? this.currentTime)
            }
        }

        track.detached = animation
        this.numOut++
        this.hasStarted && this.settle()

        return animation
    }

    /**
     * With every value on its own animation, the clip stops its clock
     * and reports the first one's.
     */
    private settle() {
        if (this.lead || this.numLive() || this.numPending > 0) return
        const lead = (this.lead = this.tracks.find((t) => t.detached)?.detached)
        if (!lead) return
        this.teardown()
        Object.defineProperties(this, {
            state: { get: () => lead.state, set() {} },
            startTime: { get: () => lead.startTime, set() {} },
        })
    }

    private detachLive() {
        this.numPending && flushKeyframeResolvers()
        for (const track of this.tracks) {
            track.isStopped || track.isScrolling || this.detach(track)
        }
    }

    /**
     * A detached value was stopped by another animation of its value.
     */
    interrupt() {
        this.isInterrupted = true
    }
}

/**
 * A pooled WAAPI animation's finish: set its value and style to the end,
 * as the animation's fill is removed.
 */
function onNativeFinish(this: Animation) {
    const track: ClipTrack = (this as any).track
    const { options, clip } = track
    const keyframe = getFinalKeyframe(
        options.keyframes,
        options,
        (options as any).finalKeyframe,
        clip.speed
    )
    track.update(keyframe)
    setStyle((this as any).el, options.name!, keyframe)
    this.onfinish = null
    this.cancel()
    track.finish()
}

const jsAnimationProto = JSAnimation.prototype
const setTime = Object.getOwnPropertyDescriptor(jsAnimationProto, "time")!.set!
const setSpeed = Object.getOwnPropertyDescriptor(jsAnimationProto, "speed")!
    .set!
