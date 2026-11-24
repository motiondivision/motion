import { millisecondsToSeconds, secondsToMilliseconds } from "motion-utils"
import { time } from "../frameloop/sync-time"
import { animateStyle, setStyle } from "../effects/style/output"
import { sampleDelta } from "./utils/sample-delta"
import { flushKeyframeResolvers } from "./keyframes/KeyframesResolver"
import { getFinalKeyframe } from "./keyframes/get-final"
import { inertia } from "./generators/inertia"
import { frameloopDriver } from "./drivers/frame"
import { generateTrack, initTrack, Track } from "./track"
import {
    AnimationPlaybackControls,
    AnimationPlaybackControlsWithThen,
    AnimationState,
    AnyResolvedKeyframe,
    KeyframeGenerator,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "./types"
import { Driver, DriverControls } from "./drivers/types"
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
} from "./waapi/transforms/TransformAnimation"

/**
 * One value of a MultiValueAnimation. It's the value's animation (what the motion value
 * holds and stops) and keeps what it takes to sample the value at the
 * animation's time. It has no clock of its own: a control of one value
 * controls the shared animation.
 */
export class ValueTrack<T extends AnyResolvedKeyframe = any>
    extends WithPromise
    implements Track<T>, AnimationPlaybackControlsWithThen
{
    generator!: KeyframeGenerator<T>
    mirroredGenerator: KeyframeGenerator<T> | undefined
    mixKeyframes: Mixer<T> | undefined
    calculatedDuration: number
    resolvedDuration: number
    totalDuration: number
    delayState?: AnimationState<T>
    name: string

    isDone?: boolean
    isStopped?: boolean
    isReady?: boolean
    canAccelerate?: boolean

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
    scrollTimeline?: TimelineWithFallback

    /**
     * Interrupted by another animation of the same value.
     */
    stop: VoidFunction

    constructor(
        public parent: MultiValueAnimation,
        public options: ValueAnimationOptions<T>,
        public value: MotionValue<T>,
        public plan: ValuePlan,
        /** @internal */
        public onDone: VoidFunction
    ) {
        super()
        this.name = options.name!
        this.calculatedDuration = this.resolvedDuration = this.totalDuration = 0
        this.stop = () => stopTrack(this)
    }

    /**
     * Set the value, and call the transition's onUpdate.
     */
    update(latest: T) {
        this.value.set(latest)
        this.plan.transition.onUpdate?.(latest)
    }

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
        this.parent.onTrackReady(this)
        this.isTransform && this.parent.state === "running" && joinTrack(this)
    }

    /**
     * Its time in ms, delay included: the shared clock's, or where a
     * native scroll timeline has it.
     */
    at(timestamp: number): number {
        return (
            (this.scrollTimeline && this.group?.scrollTime(this)) ??
            timeOf(this.parent, this, at(this.parent, timestamp))
        )
    }

    sampleAt(timestamp: number, resolved?: boolean) {
        return this.sampleTime(this.at(timestamp), resolved)
    }

    /**
     * Its value at a time in ms, delay included. Past its end that's its
     * final keyframe, unless `sampled`, which reads its generator there
     * too.
     */
    sampleTime(t: number, resolved?: boolean, sampled?: boolean) {
        this.generator || initTrack(this)
        const { options, totalDuration } = this
        t -= options.delay || 0
        return !sampled && t >= totalDuration && options.type !== inertia
            ? getFinalKeyframe(
                  options.keyframes,
                  options,
                  resolved ? undefined : (options as any).finalKeyframe
              )
            : generateTrack(this, Math.max(t, 0), t < 0).value
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
            this.parent.holdTime !== null
                ? value
                : this.sampleAt(now - sampleDelta, true),
            value,
            sampleDelta
        )
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

    /**
     * The value now, while WAAPI plays it and doesn't set it.
     */
    liveValue() {
        return (this.native && !this.isDone) || this.isAccelerated()
            ? this.sampleAt(time.now())
            : undefined
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
        return this.parent.startTime
    }

    get time() {
        return this.parent.time
    }

    set time(newTime: number) {
        this.parent.time = newTime
    }

    get speed() {
        return this.parent.speed
    }

    set speed(newSpeed: number) {
        this.parent.speed = newSpeed
    }

    play() {
        this.parent.play()
    }

    pause() {
        this.parent.pause()
    }

    /**
     * Finish this value now, at its end, or played backwards, its start.
     * Inertia has no target to end at, only where it is by now.
     */
    complete() {
        if (this.isDone) return
        this.update(
            this.options.type === inertia
                ? this.sampleAt(time.now())
                : endTrack(this)
        )
        finishTrack(this)
    }

    cancel() {
        this.parent.cancel()
    }

    attachTimeline(timeline: TimelineWithFallback) {
        return this.parent.attachTimeline(timeline)
    }
}

/**
 * Join its element's transform group, which composes it from now.
 */
function joinTrack(track: ValueTrack) {
    anchor(track.parent, time.now())
    const group = (track.group = joinGroup(track))
    group.isJS || group.schedule(false)
}

function finishTrack(track: ValueTrack) {
    const { parent, group } = track
    track.isDone || parent.numDone++
    track.isDone = true
    track.notifyFinished()
    track.onDone()
    track.plan.transition.onComplete?.()
    group && !group.isFinishing && group.release(track)
    ;(track.native || group) && check(parent)
}

/**
 * Its last keyframe, or played backwards, its first.
 */
function endTrack(track: ValueTrack) {
    const { options } = track
    return getFinalKeyframe(
        options.keyframes,
        options,
        (options as any).finalKeyframe,
        track.parent.speed
    )
}

function stopTrack(track: ValueTrack) {
    if (track.isStopped) return
    track.parent.state === "idle" || track.options.onStop?.()
    track.isStopped = true
    track.resolver?.cancel()
    removeTrack(track.parent, track)
}

/**
 * What makes a shared animation follow a timeline, held here so that
 * animations that are never attached to one don't carry it.
 */
export const timelineSupport: {
    attach?: (
        animation: MultiValueAnimation,
        timeline: TimelineWithFallback
    ) => VoidFunction
} = {}

/**
 * Many values animated on one clock, as one animate() call makes them.
 * Time, speed and playback are kept once, and each frame is one loop over
 * the values rather than one animation each.
 */
export class MultiValueAnimation
    extends WithPromise
    implements AnimationPlaybackControlsWithThen
{
    state: AnimationPlayState = "idle"

    startTime: number | null

    /**
     * The driver that's controlling the animation loop. Normally this is a requestAnimationFrame loop
     * but in tests we can pass in a synchronous loop.
     */
    /** @internal */
    driver?: DriverControls

    /** @internal */
    isStopped?: boolean

    /**
     * The start time this animation picked for itself, until its first tick.
     */
    /** @internal */
    pendingStartTime?: number

    /** @internal */
    calculatedDuration: number

    /** @internal */
    totalDuration: number

    /** @internal */
    options: ValueAnimationOptions<any>

    /**
     * The current time of the animation.
     */
    /** @internal */
    currentTime: number

    /**
     * The time at which the animation was paused.
     */
    /** @internal */
    holdTime: number | null

    /**
     * Playback speed as a factor. 0 would be stopped, -1 reverse and 2 double speed.
     */
    /** @internal */
    playbackSpeed = 1

    tracks: ValueTrack[] = []

    /**
     * Tracks still waiting on their keyframes.
     */
    /** @internal */
    numPending: number

    /**
     * A stopped track's animation never finishes, so neither does the
     * animation's, as with a group of animations.
     */
    /** @internal */
    isInterrupted?: boolean

    /**
     * Values that have finished.
     */
    numDone: number

    /**
     * Every value is on WAAPI, which plays and finishes it, so the clock
     * doesn't run each frame. A frame with no work lets the browser skip
     * the main thread.
     */
    /** @internal */
    isOffloaded?: boolean

    /**
     * Stopped tracks still in `tracks`, until the next tick drops them.
     */
    /** @internal */
    numOut: number

    /**
     * Cancelled, every value is set back to its start, the composed
     * transforms included.
     */
    /** @internal */
    isCancelled?: boolean

    /**
     * Cancelling, so values on WAAPI are set back to their start from JS.
     */
    /** @internal */
    isCancelling?: boolean

    /** @internal */
    unfollow?: VoidFunction

    /**
     * This method is bound to the instance to fix a pattern where
     * animation.stop is returned as a reference from a useEffect.
     */
    stop: VoidFunction

    constructor(driver?: Driver) {
        super()
        this.startTime = this.holdTime = null
        this.calculatedDuration =
            this.totalDuration =
            this.currentTime =
            this.numPending =
            this.numDone =
            this.numOut =
                0
        this.options = { driver } as any
        this.stop = () => this.stopAnimation()
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

    onTrackReady(track: ValueTrack, handle: unknown = track) {
        notifyAnimationStart(handle, track.options)
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
        run(this)
        this.options.autoplay === false
            ? hold(this)
            : regroup(this, false, true)
        natives(this, (native) => syncNative(this, native))
    }

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

        const native = animateStyle(element, frames, { ...timing, delay })

        /**
         * Its generator is only made if it's read or interrupted.
         */
        const { duration, iterations } = timing as any
        track.calculatedDuration = track.resolvedDuration = duration
        track.totalDuration = duration * iterations
        track.native = native
        track.isReady = true
        track.resolver = undefined
        watch(native, track)
        this.onTrackReady(track)
        syncNative(this, native)
    }

    get duration() {
        this.numPending && flushKeyframeResolvers()
        return millisecondsToSeconds(this.calculatedDuration)
    }

    get iterationDuration() {
        this.numPending && flushKeyframeResolvers()
        let max = 0
        for (const { calculatedDuration, options } of this.tracks) {
            max = Math.max(max, calculatedDuration + (options.delay || 0))
        }
        return millisecondsToSeconds(max)
    }

    /**
     * Run the clock again, for values that move to the main thread.
     */
    get js() {
        return this.isOffloaded ? this.driver : undefined
    }

    tick(timestamp: number): AnimationState<any> {
        if (this.startTime === null) return undefined as any

        anchor(this, timestamp)

        const { playbackSpeed: speed, holdTime, totalDuration, tracks } = this

        if (speed) {
            this.startTime = Math.min(
                this.startTime,
                speed > 0 ? timestamp : timestamp - totalDuration / speed
            )
        }

        this.updateTime(timestamp)

        const clockTime = this.currentTime
        const isForwards = speed >= 0
        const isUnheld = holdTime === null
        const isFinished = this.state === "finished" && isUnheld
        const isRunning = this.state === "running" && isUnheld
        const currentSpan = span(this)
        let numActive = this.numPending
        let numOff = 0
        let hasTime = false

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i]
            if (track.isDone || track.isStopped || !track.isReady) continue

            const { options } = track
            const delay = options.delay || 0
            const trackDuration = track.totalDuration

            const timeWithoutDelay =
                timeOf(this, track, clockTime, currentSpan) -
                (isForwards ? delay : -delay)
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

            /**
             * A value waiting out its delay holds its first keyframe. Once
             * it's there, nothing changes until the delay ends, unless an
             * onUpdate or a passive effect wants every frame.
             */
            if (
                isInDelayPhase &&
                !isFinished &&
                (track.value as any).get?.() === options.keyframes[0] &&
                !track.plan.transition.onUpdate &&
                !(track.value as any).passiveEffect
            ) {
                numActive++
                continue
            }

            const state = generateTrack(track, t, isInDelayPhase)
            let { value } = state
            const done =
                !isInDelayPhase &&
                (isForwards
                    ? track.calculatedDuration < Infinity
                        ? t >= trackDuration
                        : state.done
                    : t <= 0)

            const isTrackFinished = isFinished || (isRunning && done)

            if (isTrackFinished && options.type !== inertia) {
                value = endTrack(track)
            }

            track.update(value)

            if (isTrackFinished) {
                finishTrack(track)
            } else {
                numActive++
            }
        }

        if (this.numOut) {
            this.tracks = tracks.filter((track) => !track.isStopped)
            this.numOut = 0
        }

        this.isOffloaded = numActive > 0 && numActive === numOff
        if (!numActive && (isRunning || isFinished)) this.finish()

        return undefined as any
    }

    finish() {
        teardown(this, "finished")
        check(this)
    }

    play() {
        if (this.isStopped) return
        if (this.state === "finished") revive(this)
        this.isCancelled = false
        run(this)
        natives(this, (native, track) => {
            watch(native, track)
            native.play()
        })
        regroup(this, false, true)
    }

    pause() {
        hold(this)
        natives(this, (native) => syncNative(this, native))
        regroup(this)
    }

    complete() {
        if (this.state !== "running") {
            this.play()
        }

        this.state = "finished"
        this.holdTime = null
        this.js?.start()
        natives(this, (native) => native.finish())
    }

    cancel() {
        this.isCancelling = this.isCancelled = true
        this.holdTime = null
        this.startTime = 0
        this.tick(0)
        teardown(this)
        fire(this, "onCancel")
        this.isCancelling = false
        natives(
            this,
            (native) => {
                watch(native)
                native.cancel()
            },
            true
        )
        leaveGroups(this)
    }

    get time() {
        this.isOffloaded && this.tick(time.now())
        return millisecondsToSeconds(this.currentTime)
    }

    set time(newTime: number) {
        setTime(this, secondsToMilliseconds(newTime), true)
    }

    get speed() {
        return this.playbackSpeed
    }

    set speed(newSpeed: number) {
        const hasChanged = this.playbackSpeed !== newSpeed && this.driver
        if (hasChanged) this.updateTime(time.now())
        this.playbackSpeed = newSpeed
        if (hasChanged) setTime(this, this.currentTime)
        natives(this, (native) => (native.playbackRate = newSpeed))
        regroup(this)
    }

    protected stopAnimation() {
        /**
         * Values not yet set this frame are caught up to now.
         */
        for (const track of this.tracks) {
            track.isStopped || leave(this, track)
        }

        this.isStopped = true
        if (this.state !== "idle") {
            teardown(this)
            fire(this, "onStop")
        }
        leaveGroups(this)
    }

    /**
     * Follow a timeline. The work is done by what `timelineSupport` holds,
     * which the code that makes animations to attach sets, so that
     * animations that are never attached don't carry it.
     */
    attachTimeline(timeline: TimelineWithFallback): VoidFunction {
        return timelineSupport.attach!(this, timeline)
    }

    /**
     * Follow a timeline on the shared clock, from JS.
     */
    follow(timeline: TimelineWithFallback) {
        this.unfollow ||= (this.driver?.stop(), timeline.observe(this))
    }
}

/**
 * This animation's time, including delay, at a timestamp.
 */
function at(anim: MultiValueAnimation, timestamp: number) {
    return (
        anim.holdTime ??
        Math.round((timestamp - anim.startTime!) * anim.playbackSpeed * 10000) /
            10000
    )
}

/**
 * Call a lifecycle callback of each value still in the animation.
 */
function fire(
    anim: MultiValueAnimation,
    key: "onPlay" | "onStop" | "onCancel"
) {
    for (const track of anim.tracks) {
        track.isStopped || track.options[key]?.()
    }
}

/**
 * Start a WAAPI animation from the animation's start time and state.
 */
function syncNative(anim: MultiValueAnimation, native: Animation) {
    if (anim.isCancelled) return native.cancel()
    if (anim.startTime === null) return
    if (anim.state === "paused") {
        native.pause()
        native.currentTime = anim.holdTime ?? 0
    } else {
        native.startTime = anchor(anim, time.now())
    }
}

/**
 * A start time that was given is kept. One the animation picked may
 * have been long ago by the time its keyframes resolve, or its first
 * frame renders, so it starts from then instead. That's decided once,
 * by whichever of WAAPI and the first tick needs it first, so the
 * values WAAPI plays and the clock run from the same time.
 */
function anchor(anim: MultiValueAnimation, now: number) {
    if (anim.startTime === anim.pendingStartTime) {
        anim.startTime = resolveStartTime(anim.startTime!, now)
    }
    anim.pendingStartTime = undefined
    return anim.startTime
}

/**
 * Apply a control to the tracks on WAAPI. Those on a scroll timeline
 * follow it, so only a cancel reaches them.
 */
function natives(
    anim: MultiValueAnimation,
    control: (native: Animation, track: ValueTrack) => void,
    all?: boolean
) {
    for (const track of anim.tracks) {
        const { native } = track
        native &&
            !track.isStopped &&
            (all || !track.isScrolling) &&
            control(native, track)
    }
}

/**
 * A track's value at a timestamp, from the animation's time.
 */
const valueAt = (track: ValueTrack, timestamp: number) =>
    track.sampleTime(track.at(timestamp), false, true)

/**
 * A track's time, delay included, at a time of the clock. Following a
 * timeline from JS, the clock runs over the longest value, and each
 * value spans the timeline, as an animation of its own would.
 */
function timeOf(
    anim: MultiValueAnimation,
    { calculatedDuration, options }: ValueTrack,
    clockTime: number,
    currentSpan = span(anim)
) {
    return currentSpan
        ? (clockTime * (calculatedDuration + (options.delay || 0))) /
              currentSpan
        : clockTime
}

/**
 * The time the clock runs over while it follows a timeline from JS.
 */
function span(anim: MultiValueAnimation) {
    return anim.unfollow && secondsToMilliseconds(anim.iterationDuration)
}

/**
 * Take a track off WAAPI, leaving its value, with velocity, and the
 * style where it was.
 */
function release(anim: MultiValueAnimation, track: ValueTrack) {
    const native = track.native!
    const isPseudo = (track.options as any).pseudoElement
    track.native = undefined
    watch(native)

    if (!track.isDone && anim.startTime !== null) {
        const now = time.now()
        const speed = anim.playbackSpeed
        const delta = anim.state === "running" && speed ? sampleDelta : 0
        const current = valueAt(track, now)
        isPseudo || commit(track, current)
        track.value.setWithVelocity(
            valueAt(track, now - delta * Math.sign(speed)),
            current,
            delta / Math.abs(speed || 1)
        )
    }

    isPseudo || native.cancel()
}

/**
 * The shared animation is finished once every value still in it is.
 * Its promise resolves then, unless a value was stopped, as with a
 * group of animations.
 */
function check(anim: MultiValueAnimation) {
    if (anim.numDone < anim.tracks.length - anim.numOut) return
    /**
     * WAAPI finished its last values before the animation's next frame.
     */
    if (anim.startTime !== null) {
        anim.currentTime = anim.playbackSpeed < 0 ? 0 : anim.totalDuration
        teardown(anim, "finished")
    }
    anim.isInterrupted || anim.notifyFinished()
}

/**
 * Revive values that finished, as a group of animations does when
 * it's played or seeked again.
 */
function revive(anim: MultiValueAnimation) {
    for (const track of anim.tracks) {
        if (track.isDone) {
            track.isDone = false
            anim.numDone--
            track.updateFinished()
        }
    }
}

/**
 * Start, or resume, the clock.
 */
function run(anim: MultiValueAnimation) {
    const { driver = frameloopDriver, startTime } = anim.options

    if (!anim.driver) {
        anim.driver = driver((timestamp) => {
            anim.tick(timestamp)
            anim.isOffloaded && anim.driver?.stop()
        })
    }

    fire(anim, "onPlay")

    const now = anim.driver.now()

    if (anim.state === "finished") {
        anim.updateFinished()
        anim.startTime =
            now + (anim.playbackSpeed < 0 ? anim.calculatedDuration : 0)
    } else if (anim.holdTime !== null) {
        anim.startTime = now - anim.holdTime / (anim.playbackSpeed || 1)
    } else if (!anim.startTime) {
        anim.startTime = startTime ?? (anim.pendingStartTime = now)
    }

    anim.holdTime = null

    /**
     * Set playState to running only after we've used it in
     * the previous logic.
     */
    anim.state = "running"

    anim.driver.start()
}

/**
 * Hold the clock where it is.
 */
function hold(anim: MultiValueAnimation) {
    anim.state = "paused"
    anim.updateTime(time.now())
    anim.holdTime = anim.currentTime
}

function setTime(anim: MultiValueAnimation, ms: number, isSeek?: boolean) {
    revive(anim)

    /**
     * Seeking out of "finished" leaves the animation paused, so play()
     * won't renew finished. Renew it here.
     */
    if (anim.state === "finished") anim.updateFinished()

    anim.currentTime = ms
    const { driver, playbackSpeed } = anim

    if (driver) {
        if (
            anim.startTime === null ||
            anim.holdTime !== null ||
            !playbackSpeed
        ) {
            anim.holdTime = ms
        } else {
            anim.startTime = driver.now() - ms / playbackSpeed
        }
        driver.start(false)
    } else {
        anim.startTime = 0
        anim.state = "paused"
        anim.holdTime = ms
        anim.tick(ms)
    }

    natives(anim, (native, track) => {
        watch(native, track)
        native.currentTime = ms
        anim.holdTime === null && native.play()
    })
    isSeek && regroup(anim, true)
}

/**
 * The transform groups of its values follow a change to its playback,
 * which a seek may need them to rebuild for. Played, values that left
 * their group join it again.
 */
function regroup(
    anim: MultiValueAnimation,
    isSeek?: boolean,
    isPlay?: boolean
) {
    for (const track of anim.tracks) {
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
            ? joinTrack(track)
            : group && !group.isJS && group.schedule(false, isSeek)
    }
}

function leaveGroups(anim: MultiValueAnimation) {
    for (const track of anim.tracks) track.group?.release(track)
}

function teardown(
    anim: MultiValueAnimation,
    nextState: AnimationPlayState = "idle"
) {
    anim.state = nextState
    anim.driver?.stop()
    anim.driver = undefined
    anim.startTime = anim.holdTime = null
}

/**
 * Take a track off WAAPI, or the compositor, or catch it up, so its
 * value is where it was stopped.
 */
function leave(anim: MultiValueAnimation, track: ValueTrack) {
    if (track.native) {
        release(anim, track)
    } else if (track.isAccelerated()) {
        track.sync()
    } else {
        const now = time.now()
        if (
            track.isReady &&
            !track.isDone &&
            anim.startTime !== null &&
            track.value.updatedAt !== now
        ) {
            /**
             * Marked as updated now, the value keeps its sample from the
             * previous frame, so the velocity an interrupting animation
             * inherits is measured from there, not from the part of a
             * frame since.
             */
            track.value.updatedAt = now
            track.update(valueAt(track, now))
        }
    }
}

/**
 * A track stopped by another animation of its value. It's sampled
 * now, so the value and its velocity are current.
 */
function removeTrack(anim: MultiValueAnimation, track: ValueTrack) {
    leave(anim, track)
    track.group?.release(track)

    if (!track.isReady) anim.numPending--
    if (track.isDone) {
        track.isDone = false
        anim.numDone--
    }

    anim.isInterrupted = true
    anim.numOut++

    if (anim.numOut === anim.tracks.length) teardown(anim)
}

/**
 * A pooled WAAPI animation's finish: set its value and style to the end,
 * as the animation's fill is removed.
 */
function onNativeFinish(this: Animation) {
    const track: ValueTrack = (this as any).track
    const keyframe = endTrack(track)
    watch(this)
    if (!(track.options as any).pseudoElement) {
        track.update(keyframe)
        commit(track, keyframe)
        this.cancel()
    }
    finishTrack(track)
}

/**
 * Write a value as its element's inline style, unless the element has
 * unmounted since.
 */
const commit = (track: ValueTrack, value: AnyResolvedKeyframe) => {
    const element = track.value.owner!.current as HTMLElement | null
    element && setStyle(element, track.name, value)
}

/**
 * A pooled WAAPI animation points at its track only while it can finish.
 * WebKit never collects an animation once it has run, nor anything it
 * references (#4034), so it's left pointing at nothing.
 */
export function watch(native: Animation, track?: ValueTrack) {
    ;(native as any).track = track
    native.onfinish = track ? onNativeFinish : null
}
