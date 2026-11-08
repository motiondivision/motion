import { millisecondsToSeconds, secondsToMilliseconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { setStyle } from "../render/dom/style-set"
import { supportsScrollTimeline } from "../utils/supports/scroll-timeline"
import { sampleDelta } from "./utils/sample-delta"
import { flushKeyframeResolvers } from "./keyframes/KeyframesResolver"
import { getFinalKeyframe } from "./keyframes/get-final"
import { inertia } from "./generators/inertia"
import { AnimationClock } from "./AnimationClock"
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
import type { ValuePlan } from "./animate/multi-value"
import {
    canAccelerateTransform,
    joinGroup,
    TransformGroup,
    TransformMember,
} from "./waapi/transforms/TransformAnimation"

/**
 * One value of a MultiValueAnimation. It's the value's animation (what the motion value
 * holds and stops) and keeps what it takes to sample the value at the
 * animation's time. It has no clock of its own: a control of one value
 * controls the shared animation.
 */
export class ValueTrack<T extends AnyResolvedKeyframe = any>
    extends WithPromise
    implements Track<T>, AnimationPlaybackControlsWithThen, TransformMember
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
     * Reads this value's keyframes from its subject, until they're read.
     */
    resolver?: { cancel(): void }

    /**
     * The WAAPI animation playing this value, controlled by the shared animation with
     * the others it pools. The track still samples the value when it's
     * read or interrupted.
     */
    native?: Animation

    /**
     * On WAAPI, following a native scroll timeline.
     */
    isScrolling?: boolean

    /**
     * A transform, composed with its element's other transforms into one
     * WAAPI animation by its group while it can be.
     */
    isTransform?: boolean
    group?: TransformGroup
    canAccelerate = false
    scrollTimeline?: TimelineWithFallback

    constructor(
        public parent: MultiValueAnimation,
        public options: ValueAnimationOptions<T>,
        public value: MotionValue<T>,
        public plan: ValuePlan,
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

    /**
     * Its keyframes are read and its durations known.
     */
    isReady = false

    /**
     * Keyframes are resolved: work out the generator and durations.
     */
    init() {
        this.resolver = undefined
        if (this.isStopped) return
        this.isReady = true

        /**
         * Before its type is replaced with its generator.
         */
        if (this.isTransform) {
            this.canAccelerate = canAccelerateTransform(this.options)
        }
        initTrack(this)
        notifyAnimationStart(this, this.options)
        this.parent.onTrackReady(this)
        this.isTransform && this.parent.state === "running" && this.join()
    }

    /**
     * Join its element's transform group, which composes it from now.
     */
    join() {
        const group = (this.group = joinGroup(this))
        group.isJS || group.schedule(false)
    }

    get name() {
        return this.options.name!
    }

    /**
     * Its time in ms, delay included: the shared clock's, or where a
     * native scroll timeline has it.
     */
    at(timestamp: number): number {
        return (
            (this.scrollTimeline && this.group!.scrollTime(this)) ??
            this.parent.at(timestamp)
        )
    }

    sampleAt(timestamp: number, resolved?: boolean) {
        return this.sampleTime(this.at(timestamp), resolved)
    }

    sampleTime(time: number, resolved?: boolean) {
        this.generator || initTrack(this)
        const { options, totalDuration } = this
        const t = time - (options.delay || 0)
        return t >= totalDuration && options.type !== inertia
            ? getFinalKeyframe(
                  options.keyframes,
                  options,
                  resolved ? undefined : (options as any).finalKeyframe
              )
            : generateTrack(this, Math.max(t, 0), t < 0).value
    }

    /**
     * When it stops moving, or, if it repeats forever, when it starts
     * repeating, and how long each repeat takes. Held, it never stops.
     */
    timing() {
        const { startTime, speed, totalDuration } = this
        const { delay = 0, repeatType } = this.options
        return this.parent.isHeld()
            ? [Infinity, 0]
            : totalDuration === Infinity
            ? [
                  startTime! + delay / speed,
                  (this.resolvedDuration * (repeatType === "loop" ? 1 : 2)) /
                      speed || 1,
              ]
            : [startTime! + (delay + totalDuration) / speed, 0]
    }

    /**
     * Whether its group runs it on the compositor.
     */
    isAccelerated(): boolean | undefined {
        const { group } = this
        return (
            group &&
            !group.isJS &&
            this.canAccelerate &&
            !this.isDone &&
            group.tracks.has(this)
        )
    }

    /**
     * Write where the compositor has it, and its velocity, to the value.
     */
    sync() {
        const now = time.now()
        const value = this.sampleAt(now, true)
        this.value.setWithVelocity(
            this.parent.isHeld()
                ? value
                : this.sampleAt(now - sampleDelta, true),
            value,
            sampleDelta
        )
    }

    /**
     * Its group finishes it where the compositor ended it, at its end, or
     * played backwards, its start.
     */
    tick() {
        this.complete()
    }

    stopJS() {}

    get js() {
        return this.parent.js
    }

    /**
     * Follow a timeline on the shared clock, from JS.
     */
    observe() {
        const timeline = this.scrollTimeline
        this.scrollTimeline = undefined
        this.canAccelerate = false
        timeline && this.parent.follow(timeline)
    }

    /**
     * What a group of animations holds for this value: the shared animation, while
     * the value plays in it.
     */
    get grouped(): AnimationPlaybackControls {
        return this.parent
    }

    finish() {
        this.isDone || this.parent.numDone++
        this.isDone = true
        this.notifyFinished()
        this.onDone()
        this.plan.transition.onComplete?.()
        const { group } = this
        group && !group.isFinishing && group.release(this)
        ;(this.native || group) && this.parent.check()
    }

    /**
     * The value now, while WAAPI plays it and doesn't set it.
     */
    liveValue() {
        return (this.native && !this.isDone) || this.isAccelerated()
            ? this.sampleAt(time.now())
            : undefined
    }

    revive() {
        if (this.isDone) {
            this.isDone = false
            this.parent.numDone--
            this.updateFinished()
        }
    }

    /**
     * Interrupted by another animation of the same value.
     */
    stop = () => {
        if (this.isStopped) return
        this.parent.state === "idle" || this.options.onStop?.()
        this.isStopped = true
        this.resolver?.cancel()
        this.parent.removeTrack(this)
    }

    /**
     * What controls this value: the shared animation, which a control of
     * one value controls for all of them.
     */
    private get own(): AnimationPlaybackControlsWithThen {
        return this.parent
    }

    get duration() {
        this.isReady || flushKeyframeResolvers()
        return millisecondsToSeconds(this.calculatedDuration)
    }

    get iterationDuration() {
        return this.duration + millisecondsToSeconds(this.options.delay || 0)
    }

    get state() {
        return this.isDone
            ? "finished"
            : this.isStopped
            ? "idle"
            : this.parent.state
    }

    get startTime() {
        return this.own.startTime
    }

    get time() {
        return this.own.time
    }

    set time(newTime: number) {
        this.own.time = newTime
    }

    get speed() {
        return this.own.speed
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

    /**
     * Finish this value now, at its end, or played backwards, its start.
     */
    complete() {
        if (this.isDone) return
        const { options } = this
        this.update(
            getFinalKeyframe(
                options.keyframes,
                options,
                (options as any).finalKeyframe,
                this.parent.speed
            )
        )
        this.finish()
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
export class MultiValueAnimation extends AnimationClock<any> {
    tracks: ValueTrack[] = []

    /**
     * Tracks still waiting on their keyframes.
     */
    private numPending = 0

    /**
     * A stopped track's animation never finishes, so neither does the
     * animation's, as with a group of animations.
     */
    private isInterrupted = false

    /**
     * Values that have finished.
     */
    numDone = 0

    /**
     * Every value is on WAAPI, which plays and finishes it, so the clock
     * doesn't run each frame. A frame with no work lets the browser skip
     * the main thread.
     */
    private isOffloaded = false

    private hasStoppedTracks = false

    constructor(driver?: Driver) {
        super({ driver } as any)
        this.calculatedDuration = this.totalDuration = 0
        this.options.onPlay = () => this.fire("onPlay")
        this.options.onCancel = () => this.fire("onCancel")
    }

    /**
     * Call a lifecycle callback of each value still in the animation.
     */
    private fire(key: "onPlay" | "onStop" | "onCancel") {
        for (const track of this.tracks) {
            track.isStopped || track.options[key]?.()
        }
    }

    /**
     * Add a value. Its track joins the clock once init() is called with
     * its keyframes resolved.
     */
    add<T extends AnyResolvedKeyframe>(
        options: ValueAnimationOptions<T>,
        value: MotionValue<T>,
        plan: ValuePlan,
        onComplete: VoidFunction
    ) {
        const track = new ValueTrack<T>(this, options, value, plan, onComplete)
        this.tracks.push(track)
        this.numPending++
        return track
    }

    onTrackReady(track: ValueTrack) {
        this.numPending--
        this.js?.start()
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
        super.play()
        this.options.autoplay === false
            ? super.pause()
            : this.regroup(false, true)
        this.natives((native) => this.syncNative(native))
    }

    initAnimation() {}

    /**
     * Play a track on WAAPI, pooled with the animation's other WAAPI values:
     * the shared animation controls each one directly, with timing worked out once
     * for the plan.
     */
    pool(
        track: ValueTrack,
        element: Element,
        [timing, easing]: [KeyframeAnimationOptions, string[] | undefined]
    ) {
        const { name, keyframes, times, delay } = track.options
        const frames: PropertyIndexedKeyframes = { [name!]: keyframes as any }
        if (times) frames.offset = times
        if (easing) frames.easing = easing

        const native = element.animate(frames, { ...timing, delay })

        /**
         * Its generator is only made if it's read or interrupted.
         */
        const { duration, iterations } = timing as any
        track.calculatedDuration = track.resolvedDuration = duration
        track.totalDuration = duration * iterations
        track.native = native
        track.isReady = true
        track.resolver = undefined
        ;(native as any).track = track
        ;(native as any).el = element
        native.onfinish = onNativeFinish
        notifyAnimationStart(track, track.options)
        this.onTrackReady(track)
        this.syncNative(native)
    }

    /**
     * Start a WAAPI animation from the animation's start time and state.
     */
    private syncNative(native: Animation) {
        const { startTime, state } = this
        if (this.isCancelled) return native.cancel()
        if (startTime === null) return
        if (state === "paused") {
            native.pause()
            native.currentTime = this.holdTime ?? 0
        } else {
            native.startTime = resolveStartTime(startTime, time.now())
        }
    }

    /**
     * Apply a control to the tracks on WAAPI. Those on a scroll timeline
     * follow it, so only a cancel reaches them.
     */
    private natives(control: (native: Animation) => void, all?: boolean) {
        for (const { native, isStopped, isScrolling } of this.tracks) {
            native && !isStopped && (all || !isScrolling) && control(native)
        }
    }

    /**
     * A track's value at a timestamp, from the animation's time.
     */
    valueAt(track: ValueTrack, timestamp: number) {
        track.generator || initTrack(track)
        const t = this.at(timestamp) - (track.options.delay || 0)
        return generateTrack(track, Math.max(t, 0), t < 0).value
    }

    /**
     * Take a track off WAAPI, leaving its value, with velocity, and the
     * style where it was.
     */
    private release(track: ValueTrack) {
        const native = track.native!
        const isPseudo = (track.options as any).pseudoElement
        track.native = undefined
        native.onfinish = null

        if (!track.isDone && this.startTime !== null) {
            const now = time.now()
            const speed = this.playbackSpeed
            const delta = this.state === "running" && speed ? sampleDelta : 0
            const current = this.valueAt(track, now)
            isPseudo ||
                setStyle((native as any).el, track.options.name!, current)
            track.value.setWithVelocity(
                this.valueAt(track, now - delta * Math.sign(speed)),
                current,
                delta / Math.abs(speed || 1)
            )
        }

        isPseudo || native.cancel()
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
        for (const { calculatedDuration, options } of this.tracks) {
            const d = millisecondsToSeconds(
                calculatedDuration + (options.delay || 0)
            )
            if (d > max) max = d
        }
        return max
    }

    /**
     * A shared animation of one value hands its blend to the driver, as a
     * JSAnimation does.
     */
    step(timestamp: number) {
        const { tracks } = this
        const track = tracks.length === 1 && tracks[0]
        ;(track &&
            track.isReady &&
            !track.group &&
            !track.isDone &&
            this.numLive() &&
            this.handLane(timestamp, track, (v) => track.update(v))) ||
            this.tick(timestamp)
        this.isOffloaded && this.driver?.stop()
    }

    /**
     * Run the clock again, for values that move to the main thread.
     */
    get js() {
        return this.isOffloaded ? this.driver : undefined
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
        let numOff = 0
        let hasTime = false

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i]
            if (track.isDone || track.isStopped) continue
            if (!track.isReady) continue

            const { options } = track
            const delay = options.delay || 0
            const trackDuration = track.totalDuration

            const timeWithoutDelay = clockTime - (isForwards ? delay : -delay)
            const isInDelayPhase = isForwards
                ? timeWithoutDelay < 0
                : timeWithoutDelay > trackDuration
            const t = isFinished ? trackDuration : Math.max(timeWithoutDelay, 0)

            /**
             * The shared animation reports its first value's time. It's set before
             * any value updates, so a seek from an update stands.
             */
            if (!hasTime) {
                hasTime = true
                this.currentTime = t
            }

            /**
             * WAAPI plays it, and finishes it.
             */
            if (
                track.native ||
                (!isFinished && !this.isCancelling && track.isAccelerated())
            ) {
                numActive++
                numOff++
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

        this.isOffloaded = numActive > 0 && numActive === numOff
        if (!numActive && (isRunning || isFinished)) this.finish()

        return undefined as any
    }

    finish() {
        this.teardown()
        this.state = "finished"
        this.check()
    }

    /**
     * The shared animation finishes once every value's has, unless one
     * was stopped, as with a group of animations.
     */
    check() {
        if (this.isInterrupted || this.numDone < this.tracks.length) return
        /**
         * WAAPI finished its last values before the animation's next frame.
         */
        if (this.startTime !== null) {
            this.currentTime = this.playbackSpeed < 0 ? 0 : this.totalDuration
            this.teardown()
            this.state = "finished"
        }
        this.notifyFinished()
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
        this.isCancelled = false
        super.play()
        this.natives((native) => {
            native.onfinish = onNativeFinish
            native.play()
        })
        this.regroup(false, true)
    }

    pause() {
        super.pause()
        this.natives((native) => {
            native.pause()
            native.currentTime = this.holdTime ?? native.currentTime
        })
        this.regroup()
    }

    complete() {
        super.complete()
        this.js?.start()
        this.natives((native) => native.finish())
    }

    /**
     * Cancelled, every value is set back to its start, the composed
     * transforms included.
     */
    private isCancelling = false
    private isCancelled = false

    cancel() {
        this.isCancelling = this.isCancelled = true
        super.cancel()
        this.isCancelling = false
        this.natives((native) => {
            native.onfinish = null
            native.cancel()
        }, true)
        this.leaveGroups()
    }

    get time() {
        this.isOffloaded && this.tick(time.now())
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        this.revive()
        setTime.call(this, newTime)
        this.natives((native) => {
            native.onfinish = onNativeFinish
            native.currentTime = secondsToMilliseconds(newTime)
            this.holdTime === null && native.play()
        })
        this.isRetiming || this.regroup(true)
    }

    get speed() {
        return this.playbackSpeed
    }

    /**
     * A change of speed keeps the time, which isn't a seek.
     */
    private isRetiming = false

    set speed(newSpeed: number) {
        this.isRetiming = true
        setSpeed.call(this, newSpeed)
        this.isRetiming = false
        this.natives((native) => (native.playbackRate = newSpeed))
        this.regroup()
    }

    isHeld() {
        return this.holdTime !== null
    }

    /**
     * The transform groups of its values follow a change to its playback,
     * which a seek may need them to rebuild for. Played, values that left
     * their group join it again.
     */
    private regroup(isSeek?: boolean, isPlay?: boolean) {
        for (const track of this.tracks) {
            const { group } = track
            if (
                !track.isTransform ||
                !track.isReady ||
                track.isStopped ||
                track.isDone ||
                track.scrollTimeline
            ) {
                continue
            }
            isPlay
                ? track.join()
                : group && !group.isJS && group.schedule(false, isSeek)
        }
    }

    private leaveGroups() {
        for (const track of this.tracks) track.group?.release(track)
    }

    protected stopAnimation() {
        /**
         * Values not yet set this frame are caught up to now, as a
         * JSAnimation is when stopped.
         */
        for (const track of this.tracks) {
            track.isStopped || this.leave(track)
        }

        this.isStopped = true
        if (this.state !== "idle") {
            this.teardown()
            this.fire("onStop")
        }
        this.leaveGroups()
        this.leaveGroups()
    }

    /**
     * Take a track off WAAPI, or the compositor, or catch it up, so its
     * value is where it was stopped.
     */
    private leave(track: ValueTrack) {
        track.native
            ? this.release(track)
            : track.isAccelerated()
            ? track.sync()
            : this.catchUp(track)
    }

    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        this.numPending && flushKeyframeResolvers()

        /**
         * WAAPI values follow a native scroll timeline. Without one, they
         * follow it from JS, like the rest.
         */
        const isNative = timeline.timeline && supportsScrollTimeline()

        /**
         * WAAPI values follow a native scroll timeline. Without one, they,
         * and the rest, follow it on the shared clock. An easing that was
         * only a default is made linear, as a JSAnimation's is.
         */
        for (const track of this.tracks) {
            const { native, options } = track
            if (track.isStopped) continue
            if (track.plan.base.allowFlatten) {
                native
                    ? native.effect?.updateTiming({ easing: "linear" })
                    : ((options.type = "keyframes" as any),
                      (options.ease = "linear"),
                      track.isReady && initTrack(track))
            }
            if (native && isNative) {
                native.onfinish = null
                native.timeline = timeline.timeline as any
                track.isScrolling = true
                timeline.onAttach?.(native)
            }

            /**
             * Transforms follow a native timeline on the compositor too.
             */
            if (track.isTransform) {
                isNative && track.canAccelerate
                    ? (track.scrollTimeline = timeline)
                    : track.observe()
                track.group?.schedule(true)
            }
        }
        /**
         * Only values off the native timeline follow it from JS.
         */
        for (const track of this.tracks) {
            track.isStopped ||
                track.isScrolling ||
                track.scrollTimeline ||
                this.follow(timeline)
        }
        return () => this.unfollow?.()
    }

    private unfollow?: VoidFunction

    /**
     * Follow a timeline on the shared clock, from JS.
     */
    follow(timeline: TimelineWithFallback) {
        this.unfollow ||= AnimationClock.prototype.attachTimeline.call(
            this,
            timeline
        )
    }

    /**
     * A track stopped by another animation of its value. It's sampled
     * now, as a JSAnimation is when stopped, so the value and its
     * velocity are current.
     */
    removeTrack(track: ValueTrack) {
        this.leave(track)
        track.group?.release(track)

        if (!track.isReady) this.numPending--

        this.isInterrupted = this.hasStoppedTracks = true
        this.numOut++

        if (!this.numLive() && this.numPending <= 0) this.teardown()
    }

    /**
     * Set a track's value to now, or to where it's held, unless it's
     * already been set this frame, as a JSAnimation is when stopped.
     */
    private catchUp(track: ValueTrack) {
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
}

/**
 * A pooled WAAPI animation's finish: set its value and style to the end,
 * as the animation's fill is removed.
 */
function onNativeFinish(this: Animation) {
    const track: ValueTrack = (this as any).track
    const { options, parent } = track
    const keyframe = getFinalKeyframe(
        options.keyframes,
        options,
        (options as any).finalKeyframe,
        parent.speed
    )
    this.onfinish = null
    if (!(options as any).pseudoElement) {
        track.update(keyframe)
        setStyle((this as any).el, options.name!, keyframe)
        this.cancel()
    }
    track.finish()
}

const clockProto = AnimationClock.prototype
const setTime = Object.getOwnPropertyDescriptor(clockProto, "time")!.set!
const setSpeed = Object.getOwnPropertyDescriptor(clockProto, "speed")!
    .set!
