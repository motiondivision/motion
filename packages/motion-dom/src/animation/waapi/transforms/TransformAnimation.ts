import {
    clamp,
    Easing,
    EasingFunction,
    easingDefinitionToFunction,
    isBezierDefinition,
    isEasingArray,
    millisecondsToSeconds,
} from "motion-utils"
import { frame } from "../../../frameloop/frame"
import { frameData } from "../../../frameloop/frame-data"
import { time } from "../../../frameloop/sync-time"
import {
    isDefaultTransform,
    transformFunction,
} from "../../../render/html/utils/build-transform"
import type { ResolvedValues } from "../../../render/types"
import {
    transformPropOrder,
    transformProps,
} from "../../../render/utils/keys-transform"
import type { MotionValue, Owner } from "../../../value"
import { frameloopDriver } from "../../drivers/frame"
import { Driver, DriverControls } from "../../drivers/types"
import { keyframes as keyframesGenerator } from "../../generators/keyframes"
import {
    flushKeyframeResolvers,
    KeyframeResolver,
    ResolvedKeyframes,
} from "../../keyframes/KeyframesResolver"
import { defaultOffset } from "../../keyframes/offsets/default"
import { holdDriver, JSAnimation, round } from "../../JSAnimation"
import { sampleDelta } from "../../utils/sample-delta"
import {
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "../../types"
import { resolveStartTime } from "../../utils/resolve-start-time"
import {
    applyResolvedKeyframes,
    fillAnimationDefaults,
} from "../../utils/resolved-options"
import { cubicBezierAsString } from "../easing/cubic-bezier"
import { supportedWaapiEasing } from "../easing/supported"
import { supportsWaapi } from "../supports/waapi"
import { acceleratedValues } from "../utils/accelerated-values"
import { needsMixer } from "../utils/needs-mixer"
import { supportsLinearEasing } from "../../../utils/supports/linear-easing"
import { supportsScrollTimeline } from "../../../utils/supports/scroll-timeline"
import { TransformGroupHooks, transformGroups } from "./groups"

/**
 * Independent transforms (x, y, scale, rotate etc) all write to the one
 * `transform` style, so they can't each run as their own WAAPI animation.
 * Instead, every transform animation on an element joins a group. While
 * every animation in the group follows the same timing, the group composes
 * them into a single `transform` WAAPI animation of their keyframes, with
 * their easing. The animations stay JSAnimations, but their driver doesn't
 * tick, so they do no work per frame.
 *
 * Values that share a transition, as the values of one animate() call or
 * variant do, share their timing. So do the values of a sequence, which
 * hold while another moves. Values with different timing, like a hover
 * tween joining a loop, run on the main thread until the timing is shared
 * again, as does a value that can't be accelerated or a transform
 * something else keeps writing.
 *
 * Pausing, seeking and speed changes that apply to every animation in the
 * group are made to the WAAPI animation, and animations complete on its
 * finish event.
 */

interface TransformOwner extends Owner {
    current: HTMLElement
    latestValues?: Record<string, AnyResolvedKeyframe>
    getValue(key: string): MotionValue | undefined
    projection?: { isProjecting(): boolean }
}

interface TransformDriverControls extends DriverControls {
    js: DriverControls
}

/**
 * A transform value's animation, as its group composes it: a
 * TransformAnimation, or a value on the shared clock of an animate() call.
 */
export interface TransformMember {
    readonly name: string
    readonly state: AnimationPlayState
    readonly speed: number
    readonly startTime: number | null
    readonly iterationDuration: number
    readonly resolvedDuration: number
    readonly totalDuration: number
    readonly calculatedDuration: number
    readonly options: ValueAnimationOptions<any>
    canAccelerate: boolean
    scrollTimeline?: TimelineWithFallback
    readonly js?: DriverControls
    at(timestamp: number): number
    timing(): number[]
    sampleAt(timestamp: number, resolved?: boolean): AnyResolvedKeyframe
    sampleTime(time: number, resolved?: boolean): AnyResolvedKeyframe
    sync(): void
    isAccelerated(): boolean | undefined
    complete(): void
    tick(timestamp: number): unknown
    stopJS(): void
    observe(): unknown
}

export interface TransformGroup extends TransformGroupHooks {
    tracks: Set<TransformMember>

    /**
     * Whether the group's animations are running on the main thread.
     */
    isJS: boolean

    /**
     * Whether animations are finishing because they reached their end,
     * which the WAAPI animation has already rendered.
     */
    isFinishing: boolean

    /**
     * Rebuild or retime the WAAPI animation. A churn is a change it may
     * not be able to follow, like a seek or an outside write.
     */
    schedule(needsBuild: boolean, isChurn?: boolean): void

    /**
     * An animation was stopped. Rebuild without it or, if it was the last,
     * end the group.
     */
    release(track: TransformMember): void
    demote(canReturn?: boolean): true | void

    /**
     * A track's time, from the WAAPI animation's progress while the group
     * runs on a scroll timeline.
     */
    scrollTime(track: TransformMember): number | undefined
}

/**
 * Where each animation was when the WAAPI animation was built: its time,
 * speed and whether it was held.
 */
type BuiltState = [number, number, boolean]

/**
 * How an animation runs as WAAPI keyframes: when it starts, in document
 * time, how long one iteration takes at speed 1, how many times it
 * repeats, each keyframe's offset and value, and the easing of each span
 * between them.
 */
interface NativeKeyframes {
    start: number
    duration: number
    iterations: number
    direction: PlaybackDirection
    speed: number
    offsets: number[]
    values: AnyResolvedKeyframe[]
    easings: string[]
}

/**
 * Sample at the interruption sampling rate, up to a cap for long
 * animations.
 */
const maxSamples = 50

/**
 * The gap between samples: a frame, so no two are needed in one.
 */
const sampleStep = 16

type Composed = NativeKeyframes & {
    easing: string[]
    /**
     * The keyframes of each value: the composed transform, if it has
     * transforms, and its other compositor values, like opacity.
     */
    props: Record<string, AnyResolvedKeyframe[]>
}

/**
 * If an outside write, or a seek the WAAPI animation can't follow,
 * happens again within this window, the group is being driven every
 * frame (scrubbing, drag), which is cheaper on the main thread than
 * rebuilding the WAAPI animation every frame.
 */
const churnWindow = 100

/**
 * Named easings that are the same cubic-bezier in JS and CSS.
 */
const nativeEasings = new Set(["linear", "easeIn", "easeOut", "easeInOut"])

/**
 * The last trace of each easing WAAPI can't run into linear(), with its
 * number of samples, so the elements that share an easing and duration
 * trace it once.
 */
const traced = new WeakMap<EasingFunction, [number, string]>()

const toLinear = (progressAt: (p: number) => number, samples: number) =>
    "linear(" +
    defaultOffset(Array(samples + 1)).map(
        (p) => round(progressAt(p)) + " " + round(p * 100) + "%"
    ) +
    ")"

const trace = (ease: EasingFunction, samples: number) => {
    let last = traced.get(ease)
    if (last?.[0] !== samples) {
        last = [samples, toLinear(ease, samples)]
        traced.set(ease, last)
    }
    return last[1]
}

/**
 * How many samples trace an easing over a duration.
 */
const countSamples = (duration: number) =>
    Math.min(maxSamples, Math.max(2, Math.ceil(duration / sampleDelta)))

/**
 * An easing as WAAPI runs it: a native one by name, a bezier by its
 * values, and anything else traced into linear().
 */
const easingAsString = (ease: Easing, samples: number) =>
    isBezierDefinition(ease)
        ? cubicBezierAsString(ease)
        : nativeEasings.has(ease as string)
        ? supportedWaapiEasing[ease as "linear"]
        : trace(easingDefinitionToFunction(ease), samples)

const byTime = (a: number, b: number) => a - b

const getOwner = (options: ValueAnimationOptions<any>) =>
    options.motionValue!.owner as TransformOwner

export const getGroup = (element: Element) =>
    transformGroups.get(element) as TransformGroup | undefined

/**
 * Whether an animation has ended, so can leave its group.
 */
const hasEnded = ({ state }: TransformMember) =>
    state === "idle" || state === "finished"

const read = (owner: TransformOwner, key: string) =>
    owner.latestValues ? owner.latestValues[key] : owner.getValue(key)?.get()

/**
 * Whether this animation should join its element's transform group.
 * Animations that can't be accelerated still join, so the group knows
 * to stay on the main thread while they run. Browsers without linear()
 * easing stay on the main thread.
 */
export const canGroupTransform = ({
    name,
    motionValue,
}: ValueAnimationOptions<any>) =>
    name &&
    name !== "pathRotation" &&
    transformProps.has(name) &&
    canGroup(motionValue)

const canGroup = (motionValue?: MotionValue) =>
    motionValue?.owner?.current instanceof HTMLElement &&
    supportsWaapi() &&
    supportsLinearEasing()

/**
 * Whether a value of an animate() call joins its element's group: its
 * transforms, and, if the call animates one of those, its other
 * compositor values, like opacity, which then share one WAAPI animation.
 * Alone, opacity is quicker to start on an animation of its own.
 */
export const canGroupValue = (
    options: ValueAnimationOptions<any>,
    composes?: boolean
) =>
    canGroupTransform(options) ||
    (composes &&
        options.name !== "transform" &&
        acceleratedValues.has(options.name!) &&
        canGroup(options.motionValue))

export function canAccelerateTransform(options: ValueAnimationOptions<any>) {
    const owner = getOwner(options)
    const { onUpdate, transformTemplate } = owner.getProps()

    return (
        /**
         * A handoff from an optimised appear animation is already running
         * on its own WAAPI animation. onUpdate needs every value, every
         * frame.
         */
        !options.isHandoff &&
        !onUpdate &&
        !options.hasOnUpdate &&
        /**
         * transformTemplate could output anything.
         */
        !transformTemplate &&
        options.type !== "inertia" &&
        /**
         * A literal transform, or pathRotation, replaces or adds to the
         * transform we'd build. styleEffect builds its own as "none".
         */
        (read(owner, "transform") || "none") === "none" &&
        !read(owner, "pathRotation") &&
        /**
         * Layout animations write transform every frame.
         */
        !owner.projection?.isProjecting() &&
        /**
         * A mixer that blends these values makes them every frame. It's
         * asked last, as it's user code.
         */
        !needsMixer(options)
    )
}

/**
 * Starting or stopping tells the group to update its WAAPI animation.
 * The frame loop driver is only made once the group is on the main
 * thread, as accelerated animations never tick.
 */
class TransformDriver implements TransformDriverControls {
    private driver?: DriverControls

    constructor(
        private element: Element,
        private makeDriver: Driver,
        private animation: TransformAnimation<any>
    ) {}

    get js() {
        return (this.driver ||= this.makeDriver((timestamp) =>
            this.animation.tick(timestamp)
        ))
    }

    now() {
        return this.driver || this.makeDriver !== frameloopDriver
            ? this.js.now()
            : frameData.isProcessing
            ? frameData.timestamp
            : time.now()
    }

    /**
     * keepAlive is false when seeking. Seeking the WAAPI animation is
     * free, but if a seek needs a rebuild and keeps happening, the group
     * moves to the main thread.
     */
    start(keepAlive = true) {
        const group = getGroup(this.element)
        !group || group.isJS
            ? this.js.start(keepAlive)
            : group.schedule(false, !keepAlive && !this.animation.isRetiming)
    }

    stopJS() {
        this.driver?.stop()
    }

    stop() {
        this.stopJS()
        const group = getGroup(this.element)
        group && !group.isFinishing && group.release(this.animation)
    }
}

/**
 * JSAnimation's time setter, looked up on first use rather than at module
 * load, so the module has no top-level side effects and stays
 * tree-shakeable in flattened bundles.
 */
let setTime: ((this: JSAnimation<any>, time: number) => void) | undefined
let setSpeed: ((this: JSAnimation<any>, speed: number) => void) | undefined

/**
 * A transform value's animation. It resolves its own keyframes, as
 * AsyncMotionValueAnimation does for other values, so each value is one
 * object rather than a wrapper, a resolver callback and an animation.
 * Until its keyframes resolve, anything that needs them resolves them
 * now, as AsyncMotionValueAnimation does.
 */
export class TransformAnimation<
    T extends number | string
> extends JSAnimation<T> {
    canAccelerate = false

    /**
     * Whether a speed change is rebasing the time, which, unlike a seek,
     * the WAAPI animation can follow by changing its playback rate.
     */
    isRetiming = false

    private createdAt: number

    private resolver?: KeyframeResolver

    private pendingTimeline?: TimelineWithFallback

    private stopTimeline?: VoidFunction

    /**
     * A native scroll timeline this follows. While every animation in
     * the group follows the same one, the group runs on it.
     */
    scrollTimeline?: TimelineWithFallback

    constructor(options: ValueAnimationOptions<T>) {
        super(options, true)

        this.createdAt = time.now()

        fillAnimationDefaults(options)

        /**
         * What it will be once resolved, without resolving to find out.
         */
        this.state = options.autoplay ? "running" : "paused"

        const { keyframes, name, motionValue, element } = options
        const Resolver = element?.KeyframeResolver || KeyframeResolver

        const resolver = (this.resolver = new Resolver(
            keyframes,
            (
                resolved: ResolvedKeyframes<T>,
                finalKeyframe: T,
                forced: boolean
            ) => this.onKeyframesResolved(resolved, finalKeyframe, !forced),
            name,
            motionValue,
            element
        ))
        resolver.scheduleResolve()
    }

    private onKeyframesResolved(
        keyframes: ResolvedKeyframes<T>,
        finalKeyframe: T,
        sync: boolean
    ) {
        this.resolver = undefined

        const { options } = this
        applyResolvedKeyframes(options, keyframes, finalKeyframe)

        /**
         * Start from when this was made, if the keyframes resolved soon
         * enough after, as every value of a group must share a clock.
         */
        if (sync) {
            options.startTime ??= resolveStartTime(this.createdAt, time.now())
        }

        /**
         * Before JSAnimation replaces the type with its generator.
         */
        this.canAccelerate = canAccelerateTransform(options)

        this.begin()

        if (this.pendingTimeline) {
            this.stopTimeline = this.attach(this.pendingTimeline)
            this.pendingTimeline = undefined
        }
    }

    /**
     * Resolve the keyframes now, for anything that needs them.
     */
    private flush() {
        if (this.resolver) {
            this.resolver.resume()
            flushKeyframeResolvers()
        }
    }

    get duration() {
        this.flush()
        return super.duration
    }

    sample(sampleTime: number) {
        this.flush()
        return super.sample(sampleTime)
    }

    cancel() {
        this.resolver ? this.resolver.cancel() : super.cancel()
    }

    /**
     * Before stopping, set the motion value to where the WAAPI animation
     * is now, with velocity, for the next animation to start from.
     */
    protected stopAnimation() {
        if (this.resolver) return this.resolver.cancel()

        this.isAccelerated() && this.sync()
        super.stopAnimation()
        this.stopTimeline?.()
    }

    get group() {
        return getGroup(getOwner(this.options).current)
    }

    get js() {
        return (this.driver as TransformDriverControls | undefined)?.js
    }

    stopJS() {
        ;(this.driver as TransformDriver | undefined)?.stopJS()
    }

    get name() {
        return this.options.name!
    }

    /**
     * When this stops moving, or, if it repeats forever, when it starts
     * repeating, and how long each repeat takes. Held (paused, or at
     * speed 0) animations never stop moving.
     */
    timing() {
        const { startTime, speed, totalDuration } = this
        const { delay = 0, repeatType } = this.options

        return this.holdTime !== null
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
     * Whether this is running, or paused, on the compositor.
     */
    isAccelerated(): boolean | undefined {
        const { group, state } = this
        return (
            group?.tracks.has(this) &&
            !group.isJS &&
            this.canAccelerate &&
            (state === "running" || state === "paused")
        )
    }

    /**
     * The value now, while this runs on the compositor and so doesn't
     * set its motion value every frame.
     */
    liveValue() {
        return this.isAccelerated() ? this.sampleAt(time.now()) : undefined
    }

    /**
     * Write the current value, and velocity, to the motion value.
     */
    sync() {
        const now = time.now()
        const value = this.sampleAt(now, true)

        /**
         * A held value doesn't move, so there's no need to sample it
         * twice.
         */
        this.options.motionValue!.setWithVelocity(
            this.holdTime === null
                ? this.sampleAt(now - sampleDelta, true)
                : value,
            value,
            sampleDelta
        )
    }

    play() {
        this.flush()

        /**
         * A stopped animation (one that was interrupted) can't play again,
         * so it mustn't join the group.
         */
        if (this.isStopped) return
        joinGroup(this)
        const owner = getOwner(this.options)

        /**
         * The frame loop driver is only made once the group is on the
         * main thread, as accelerated animations never tick. The driver
         * is made here rather than through options, as JSAnimation would
         * make a closure for each.
         */
        this.driver ||= new TransformDriver(
            owner.current,
            this.options.driver || frameloopDriver,
            this
        )

        super.play()
    }

    /**
     * The driver's own stop() leaves the group, so only the frame loop
     * driver of a group on the main thread is held.
     */
    protected hold() {
        this.group?.isJS && holdDriver(this.js!)
    }

    pause() {
        this.flush()
        super.pause()

        this.isAccelerated() && this.group!.schedule(false)
    }

    /**
     * JSAnimation finishes on its next tick, which only happens once the
     * group is on the main thread, so finish now. That includes an
     * animation that can't be accelerated but reached its end before the
     * group could move there.
     */
    complete() {
        this.flush()
        super.complete()
        const { group } = this
        group && !group.isJS && this.tick(time.now())
    }

    /**
     * Without a tick to rebase it, a held time still includes the delay,
     * so take it off here, as a JS animation does on its next tick.
     */
    get time() {
        if (this.isAccelerated()) {
            return millisecondsToSeconds(
                clamp(
                    0,
                    this.totalDuration,
                    this.at(time.now()) - (this.options.delay || 0)
                )
            )
        }

        return super.time
    }

    /**
     * Calls JSAnimation's setter directly, as `super.time =` is a slow
     * path in V8 and this runs for every animation of a seeked sequence.
     */
    set time(newTime: number) {
        this.flush()
        ;(setTime ??= Object.getOwnPropertyDescriptor(
            JSAnimation.prototype,
            "time"
        )!.set!).call(this, newTime)
    }

    get speed() {
        return super.speed
    }

    set speed(newSpeed: number) {
        this.isRetiming = true
        ;(setSpeed ??= Object.getOwnPropertyDescriptor(
            JSAnimation.prototype,
            "speed"
        )!.set!).call(this, newSpeed)
        this.isRetiming = false
    }

    /**
     * Scroll timelines set time every frame, so run these on the main
     * thread.
     */
    attachTimeline(timeline: TimelineWithFallback) {
        if (this.resolver) {
            this.pendingTimeline = timeline
        } else {
            this.stopTimeline = this.attach(timeline)
        }

        return () => this.stop()
    }

    private attach(timeline: TimelineWithFallback) {
        if (
            this.canAccelerate &&
            timeline.timeline &&
            supportsScrollTimeline()
        ) {
            /**
             * As JSAnimation does, a scroll-linked animation without its
             * own easing runs linearly.
             */
            if (this.options.allowFlatten) {
                this.options.type = "keyframes"
                this.options.ease = "linear"
                this.initAnimation()
            }

            this.scrollTimeline = timeline
            this.group?.schedule(true)

            return () => {
                this.scrollTimeline = undefined
            }
        }

        return this.observe(timeline)
    }

    /**
     * Follow the timeline from JS, on the main thread, as values that
     * can't run on it natively do.
     */
    observe(timeline = this.scrollTimeline!) {
        this.scrollTimeline = undefined
        this.canAccelerate = false
        this.group?.demote(true)
        return (this.stopTimeline = super.attachTimeline(timeline))
    }

    /**
     * On a scroll timeline, its time is where the timeline has it.
     */
    at(timestamp: number): number {
        return (
            (this.scrollTimeline && this.group?.scrollTime(this)) ??
            super.at(timestamp)
        )
    }
}

/**
 * This animation as WAAPI keyframes, if WAAPI can run it: keyframes
 * with easings it has or can trace, that repeat as it does. Over a
 * scroll timeline, the keyframes span the timeline, delay included.
 * Undefined if it can't, so the group runs on the main thread.
 */
export function nativeOf(
    track: TransformMember,
    isScroll?: boolean
): NativeKeyframes | undefined {
    const { startTime, speed, resolvedDuration, totalDuration, options } = track
    const { keyframes, repeat, repeatType, repeatDelay, type, delay } = options
    const samples = countSamples(resolvedDuration)
    let { ease, times } = options
    let offsets = times || defaultOffset(keyframes)
    let easings: string[]

    if (
        !(resolvedDuration < Infinity) ||
        !speed ||
        repeatType === "mirror" ||
        (isScroll && repeat) ||
        offsets.length !== keyframes.length ||
        offsets[0] ||
        offsets[offsets.length - 1] !== 1 ||
        offsets.some((o, i) => i && o <= offsets[i - 1])
    ) {
        return
    }

    if (type === keyframesGenerator) {
        ease ??= "easeInOut"
        easings = offsets
            .slice(1)
            .map((_, i) =>
                easingAsString(
                    isEasingArray(ease!) ? ease[i] || "linear" : ease!,
                    samples
                )
            )
    } else {
        /**
         * A spring moves between two keyframes along its own curve,
         * which is traced from its values. One that starts and ends
         * at the same value, which only its velocity moves, or that
         * moves between values that aren't numbers, is sampled.
         */
        const from = parseFloat(keyframes[0] as string)
        const range = parseFloat(keyframes[1] as string) - from
        if (!(Math.abs(range) > 0)) return

        offsets = [0, 1]
        easings = [
            toLinear(
                (p) =>
                    (parseFloat(
                        track.sampleTime(
                            delay! + p * resolvedDuration,
                            true
                        ) as string
                    ) -
                        from) /
                    range,
                samples
            ),
        ]
    }

    /**
     * A repeat delay holds the last keyframe for its share of each
     * iteration. Over a scroll timeline, the delay holds the first
     * keyframe for its share of the timeline.
     */
    let values = keyframes as AnyResolvedKeyframe[]
    if (repeatDelay) {
        const share = track.calculatedDuration / resolvedDuration
        offsets = [...offsets.map((o) => o * share), 1]
        values = [...values, values[values.length - 1]]
        easings.push("linear")
    }
    if (isScroll && delay) {
        const share = totalDuration / (delay + totalDuration)
        offsets = [0, ...offsets.map((o) => 1 - share + o * share)]
        values = [values[0], ...values]
        easings = ["linear", ...easings]
    }

    return {
        start: isScroll ? 0 : startTime! + delay! / speed,
        duration: isScroll ? 0 : resolvedDuration,
        iterations: isScroll ? 1 : repeat! + 1,
        direction:
            !isScroll && repeat && repeatType === "reverse"
                ? "alternate"
                : "normal",
        speed: isScroll ? 1 : speed,
        offsets,
        values,
        easings,
    }
}

/**
 * Groups that build straight after the current task build in one
 * microtask, rather than one each.
 */
let builds: VoidFunction[] | undefined

/**
 * How long before it starts a WAAPI animation is built.
 */
const buildAhead = 100

/**
 * Groups waiting to build, and when, on one timer for all of them. It
 * wakes each group when it's due, not earlier: building groups that are
 * due within the next frame together, ahead of time, makes the browser
 * recalculate style in more frames while they play.
 */
const wakes = new Map<VoidFunction, number>()
let wakeTimer: ReturnType<typeof setTimeout> | undefined
let wakeAt = Infinity

const runWakes = () => {
    wakeAt = Infinity
    const due = time.now()
    let next = Infinity
    wakes.forEach((at, wake) => {
        if (at <= due) {
            wakes.delete(wake)
            wake()
        } else if (at < next) next = at
    })
    next < Infinity && wakeIn(next - time.now())
}

const wakeIn = (delay: number) => {
    const at = time.now() + delay
    if (at < wakeAt) {
        clearTimeout(wakeTimer)
        wakeAt = at
        wakeTimer = setTimeout(runWakes, delay)
    }
    return at
}

const buildSoon = (build: VoidFunction) => {
    builds ||
        queueMicrotask(() => {
            const queue = builds!
            builds = undefined
            queue.forEach((build) => build())
        })
    ;(builds ||= []).push(build)
}

/**
 * Add an animation to its element's group, made if there isn't one.
 */
export function joinGroup(track: TransformMember) {
    const owner = getOwner(track.options)
    const group = getGroup(owner.current) || createGroup(owner)
    group.tracks.add(track)
    return group
}

function createGroup(owner: TransformOwner): TransformGroup {
    const element = owner.current
    const tracks = new Set<TransformMember>()

    /**
     * Transforms that aren't animating, as built into the WAAPI animation.
     */
    let statics: Record<string, AnyResolvedKeyframe | undefined> = {}
    /**
     * The transforms in the WAAPI animation, in order.
     */
    let keys: string[] = []
    /**
     * Its other compositor values, like opacity, which share its WAAPI
     * animation rather than having one each.
     */
    let extras: string[] = []
    /**
     * Every value it has composed, which it writes back as inline styles
     * when the WAAPI animation stops.
     */
    const committed = new Set<string>()
    let built = new Map<TransformMember, BuiltState>()
    /**
     * Builds the WAAPI animation shortly before it starts.
     */
    const wake = () => group.schedule(true)
    const sleep = (delay: number) => wakes.set(wake, wakeIn(delay))
    /**
     * How long after it was last built to build it, while waiting.
     */
    let buildAt: number | undefined
    /**
     * The WAAPI animation, when it starts relative to when the group was
     * built and how long it runs.
     */
    let native: Animation | undefined
    let nativeStart = 0
    let nativeLength = 0
    let needsBuild = false
    let isScheduled = false
    let isEnded = false
    let hasChurned = false
    let lastChurn = -Infinity

    const has = (key: string) => {
        for (const track of tracks) if (track.name === key) return true
    }

    /**
     * Build a transform from values in transformPropOrder. For a keyframe,
     * every key is written, even at its default, so each keyframe has the
     * same list of functions and the browser interpolates them one by one.
     * As an inline style, defaults are left out, as buildTransform does.
     */
    const toTransform = (values: ResolvedValues, isStyle?: boolean) => {
        let transform = ""
        for (const key in values) {
            const value = values[key]
            if (!isStyle || !isDefaultTransform(key, value)) {
                transform += transformFunction(key, value) + " "
            }
        }
        return (isStyle ? transform.trim() : transform) || "none"
    }

    /**
     * Write the transform as an inline style, from the motion values, as
     * the renderer would.
     */
    const commit = () => {
        const values: ResolvedValues = {}
        let hasTransform
        for (const key of transformPropOrder) {
            const value = read(owner, key)
            if (value !== undefined) hasTransform = values[key] = value
        }
        committed.forEach((key) => {
            const value = read(owner, key)
            if (value !== undefined) (element.style as any)[key] = value
        })
        /**
         * Without transform motion values, the element's own transform,
         * as from a stylesheet, is left alone.
         */
        hasTransform !== undefined &&
            (element.style.transform = toTransform(values, true))
    }

    /**
     * Cancel the WAAPI animation and remove its handlers, as WebKit never
     * collects an animation once it has run, nor anything its handlers
     * reference (#4034). By default the transform is committed first. The
     * renderer writes its own version on its next render.
     */
    const stop = (shouldCommit = true) => {
        shouldCommit && commit()
        wakes.delete(wake)
        buildAt = undefined
        if (native) {
            native.onfinish = native.oncancel = null
            native.cancel()
            native = scrollAnimation = undefined
        }
    }

    /**
     * The transforms that aren't animating, and those held, as statics.
     * Those at their default are left out. Returns the animating ones.
     */
    const readStatics = (now: number) => {
        const byKey = new Map<string, TransformMember>()
        statics = {}
        extras = []
        for (const track of tracks) {
            const { name } = track
            byKey.set(name, track)
            if (!transformProps.has(name)) {
                extras.push(name)
                committed.add(name)
                track.timing()[0] < Infinity ||
                    (statics[name] = track.sampleAt(now))
            }
        }
        keys = transformPropOrder.filter((key) => {
            const track = byKey.get(key)
            if (track && track.timing()[0] < Infinity) return true
            const value = (statics[key] = track
                ? track.sampleAt(now)
                : read(owner, key))
            return value !== undefined && !isDefaultTransform(key, value)
        })
        return byKey
    }

    /**
     * Empty keyframe lists for the transform, if there are transforms,
     * and each other value.
     */
    const listsFor = () => {
        const props: Composed["props"] = keys.length ? { transform: [] } : {}
        for (const key of extras) props[key] = []
        return props
    }

    /**
     * A WAAPI animation that starts by setting its startTime. Playing it
     * first, as element.animate() does, would leave WebKit holding that
     * play's ready time once startTime ends the play, and it uses that for
     * the next updatePlaybackRate(), so the animation would jump.
     */
    const create = (
        keyframes: PropertyIndexedKeyframes | null,
        options: KeyframeAnimationOptions
    ) => {
        const animation = new Animation(
            new KeyframeEffect(element, keyframes, options) as AnimationEffect
        )
        /**
         * Something else cancelled it, so carry on on the main thread.
         */
        animation.oncancel = () => native === animation && group.demote()
        return (native = animation)
    }

    /**
     * The keyframes of the composed transform, if every moving animation
     * shares its timing: when it starts, its duration, speed and repeats.
     * Each keyframe is at an offset one of them has, where the others
     * either have one too, or hold, and each span between keyframes has
     * the easing of the animations that move over it. Returns undefined
     * if they can't be composed.
     */
    const compose = (
        byKey: Map<string, TransformMember>,
        isScroll?: boolean
    ): Composed | null | undefined => {
        const natives = new Map<string, NativeKeyframes>()
        let shared: NativeKeyframes | undefined
        let offsets: number[] = []
        const all = keys.concat(extras)

        for (const key of all) {
            const track = byKey.get(key)
            if (!track || track.timing()[0] === Infinity) continue

            const keyframes = nativeOf(track, isScroll)
            if (
                !keyframes ||
                (shared &&
                    (Math.abs(keyframes.start - shared.start) > 1 ||
                        Math.abs(keyframes.duration - shared.duration) > 1 ||
                        keyframes.iterations !== shared.iterations ||
                        keyframes.direction !== shared.direction ||
                        keyframes.speed !== shared.speed))
            ) {
                return
            }

            shared ||= keyframes
            natives.set(key, keyframes)
            for (const offset of keyframes.offsets) {
                offsets.includes(offset) || offsets.push(offset)
            }
        }

        /**
         * Nothing moves.
         */
        if (!shared) return null

        offsets.sort(byTime)

        const easing: string[] = []
        const props = listsFor()

        for (let i = 0; i < offsets.length; i++) {
            const values: ResolvedValues = {}
            let spanEasing: string | undefined

            for (const key of all) {
                const keyframes = natives.get(key)
                if (!keyframes) {
                    props[key]
                        ? props[key].push(statics[key]!)
                        : (values[key] = statics[key]!)
                    continue
                }

                /**
                 * Its keyframe at this offset or, if it has none, the
                 * value it holds across it.
                 */
                let index = keyframes.offsets.indexOf(offsets[i])
                const isOwn = index >= 0
                if (!isOwn) {
                    index =
                        keyframes.offsets.findIndex((o) => o > offsets[i]) - 1
                }
                const value = keyframes.values[index]
                const isMoving = value !== keyframes.values[index + 1]
                if (!isOwn && isMoving) return
                props[key] ? props[key].push(value) : (values[key] = value)

                /**
                 * The span from this keyframe to the next has the easing
                 * of every animation that moves over it, which must agree.
                 */
                if (
                    isOwn &&
                    isMoving &&
                    i < offsets.length - 1 &&
                    keyframes.offsets[index + 1] === offsets[i + 1]
                ) {
                    const ease = keyframes.easings[index]
                    if (spanEasing && spanEasing !== ease) return
                    spanEasing = ease
                }
            }

            props.transform?.push(toTransform(values))
            i < offsets.length - 1 && easing.push(spanEasing || "linear")
        }

        return { ...shared, offsets, easing, props }
    }

    /**
     * Animations whose timing isn't shared, as when one interrupts
     * another part way through, are sampled together from now until the
     * first of them ends, as keyframes the browser runs linearly between.
     * The rest are rebuilt then, from where they are. A loop that starts
     * again in that time is sampled either side of the jump (an iteration
     * ends at, not before, its boundary), so it doesn't play as a quick
     * sweep. Returns undefined if nothing finite
     * moves.
     */
    const sample = (
        byKey: Map<string, TransformMember>,
        now: number
    ): Composed | undefined => {
        let end = Infinity
        const times: number[] = []
        const moving: TransformMember[] = []

        for (const track of tracks) {
            if (track.speed < 0) return
            const [trackEnd, cycle] = track.timing()
            if (trackEnd === Infinity) continue
            moving.push(track)
            cycle || (end = Math.min(end, trackEnd))
        }
        if (!(end < Infinity)) return

        const step = Math.max(sampleStep, (end - now) / maxSamples)
        for (let t = now; t < end; t += step) times.push(t)
        times.push(end)

        for (const track of moving) {
            const { startTime, speed, resolvedDuration, options } = track
            const { delay, repeat, repeatType } = options
            if (!repeat || repeatType !== "loop") continue
            const start = startTime! + delay! / speed
            const cycle = resolvedDuration / speed
            for (
                let t = start + cycle * Math.ceil((now - start) / cycle);
                t < end;
                t += cycle
            ) {
                t > now && times.push(t, t + 0.01)
            }
        }
        times.sort(byTime)

        const at = (key: string, t: number) => {
            const track = byKey.get(key)
            return track && track.timing()[0] < Infinity
                ? track.sampleAt(t)
                : statics[key]!
        }
        const props = listsFor()
        for (const t of times) {
            const values: ResolvedValues = {}
            for (const key of keys) values[key] = at(key, t)
            props.transform?.push(toTransform(values))
            for (const key of extras) props[key].push(at(key, t))
        }

        return {
            start: now,
            duration: end - now,
            iterations: 1,
            direction: "normal",
            speed: 1,
            offsets: times.map((t) => (t - now) / (end - now)),
            values: [],
            easings: [],
            easing: times.map(() => "linear").slice(1),
            props,
        }
    }

    /**
     * Replace the WAAPI animation with one built from now. Returns
     * undefined if the animations can't be composed.
     */
    const animate = (now: number) => {
        built = new Map()
        for (const track of tracks) {
            built.set(track, [
                track.at(now),
                track.speed,
                track.timing()[0] === Infinity,
            ])
        }

        const byKey = readStatics(now)
        let composed = compose(byKey)
        composed === undefined && (composed = sample(byKey, now))
        stop(false)

        /**
         * Everything is held, so hold it with an inline style instead.
         */
        if (composed === null) {
            commit()
            return true
        }
        if (!composed) return

        const { iterations, direction, speed, props } = composed
        let { start, duration, offsets, easing } = composed
        let endDelay = 0
        const lists = Object.values(props)
        const row = (i: number) => lists.map((list) => list[i]) + ""

        /**
         * Played once, it's built from when it starts to move until it
         * stops, as a sequence segment, holding its last keyframe until
         * the animations end.
         */
        let first = 0
        let last = offsets.length - 1
        while (first < last && row(first + 1) === row(first)) first++
        while (last > first && row(last - 1) === row(last)) last--

        if (iterations === 1 && speed > 0 && first < last) {
            const from = offsets[first]
            const span = offsets[last] - from
            start += (from * duration) / speed
            endDelay = (1 - offsets[last]) * duration
            duration *= span
            offsets = offsets
                .slice(first, last + 1)
                .map((offset) => (offset - from) / span)
            for (const key in props) {
                props[key] = props[key].slice(first, last + 1)
            }
            easing = easing.slice(first, last)

            /**
             * Until shortly before then, it isn't built, so a stagger or
             * sequence doesn't make every element a compositor layer at
             * once. Its motion values hold where it starts, for the
             * renderer to write.
             */
            const wait = start - now - buildAhead
            if (wait > 0) {
                tracks.forEach((track) => track.sync())
                sleep((buildAt = wait))
                return true
            }
        }

        /**
         * Only what moves is animated, and what doesn't is held with an
         * inline style. A transform that doesn't move, even at its
         * default, would make the element a containing block. If nothing
         * moves, the empty animation still finishes the animations.
         */
        let keyframes: PropertyIndexedKeyframes | null = null
        let isHeld = false
        const add = (key: string, values: AnyResolvedKeyframe[]) =>
            values.some((v) => v !== values[0])
                ? ((keyframes ||= {})[key] = values as string[])
                : (isHeld = true)
        for (const key in props) add(key, props[key])
        isHeld && commit()
        if (keyframes && offsets.length > 2) {
            ;(keyframes as PropertyIndexedKeyframes).offset = offsets
            easing.some((e) => e !== "linear") &&
                ((keyframes as PropertyIndexedKeyframes).easing = easing)
        }

        nativeStart = start - now
        nativeLength = duration * iterations + endDelay
        const animation = create(keyframes, {
            duration,
            iterations,
            direction,
            endDelay,
            easing: offsets.length > 2 ? "linear" : easing[0],
            fill: "both",
        })
        speed !== 1 && (animation.playbackRate = speed)
        animation.startTime = time.now() + nativeStart

        /**
         * Rebuild anything that carries on past its end.
         */
        if (iterations < Infinity) {
            animation.onfinish = () => group.schedule(true)
        }

        return true
    }

    /**
     * The WAAPI animation on a scroll timeline, while the group runs on
     * one.
     */
    let scrollAnimation: Animation | undefined

    /**
     * Build one WAAPI animation on a native scroll timeline every
     * animation follows. Each animation runs from its start to its end
     * over the timeline, as one followed from JS does.
     */
    const buildScroll = (timeline: TimelineWithFallback) => {
        built = new Map()
        const composed = compose(readStatics(time.now()), true)
        stop(false)
        if (!composed) return composed === null ? commit() : group.demote(true)

        const { offsets, easing, props } = composed
        const animation = create(
            { ...(props as PropertyIndexedKeyframes), offset: offsets, easing },
            { duration: 1000, fill: "both" }
        )
        animation.timeline = timeline.timeline as AnimationTimeline
        timeline.onAttach ? timeline.onAttach(animation) : animation.play()
        scrollAnimation = animation
    }

    /**
     * If every animation has been paused, played, seeked or sped up
     * together since the WAAPI animation was built, do the same to it.
     * Returns false if it needs rebuilding instead.
     */
    const retime = (now: number, isSeek: boolean) => {
        let elapsed: number | undefined
        let rate = 0
        let last: TransformMember | undefined

        for (const track of tracks) {
            last = track
            const state = built.get(track)
            if (!state) return false

            const [builtTime, builtSpeed, wasHeld] = state
            const trackTime = track.at(now)
            const isHeld = track.timing()[0] === Infinity

            /**
             * With nothing on the compositor, a held animation is set
             * where it's held, so it can be seeked as often as needed.
             */
            if (wasHeld) {
                if (isHeld && (trackTime === builtTime || !native)) continue
                return false
            }

            const trackElapsed = (trackTime - builtTime) / builtSpeed
            const trackRate = isHeld ? 0 : track.speed / builtSpeed

            if (elapsed === undefined) {
                elapsed = trackElapsed
                rate = trackRate
            } else if (
                Math.abs(trackElapsed - elapsed) > 1 ||
                trackRate !== rate
            ) {
                return false
            }
        }

        /**
         * Waiting to build, the values hold where they start, so only
         * when to build changes. Held, there's nothing to build yet.
         */
        if (buildAt !== undefined) {
            if (elapsed === undefined || (isSeek && rate)) return false
            wakes.delete(wake)
            if (rate < 0) {
                /**
                 * Played backwards from before it moves, it never does,
                 * so it only finishes, once back at its start.
                 */
                sleep(last!.at(now) / -last!.speed + 16)
            } else if (rate) {
                const delay = (buildAt - elapsed) / rate
                if (delay < 1) return false
                sleep(delay)
            }
            return true
        }

        if (elapsed === undefined || !native) return true

        /**
         * Seeking to before it starts, or past its end, rebuilds. A seek
         * every frame then moves the group to the main thread.
         */
        const local = elapsed - nativeStart
        if (
            (local < 0 && (isSeek || nativeStart <= 0)) ||
            local >= nativeLength
        ) {
            return false
        }

        if (
            rate &&
            native.updatePlaybackRate &&
            native.playState === "running" &&
            Math.abs(Number(native.currentTime) - local) < 20
        ) {
            /**
             * Only the speed changed. Setting playbackRate and
             * startTime restarts a running compositor animation, which
             * can render the underlying value for a frame.
             */
            native.playbackRate !== rate && native.updatePlaybackRate(rate)
        } else if (rate) {
            native.playbackRate !== rate && (native.playbackRate = rate)
            native.startTime = now - local / rate
        } else {
            /**
             * Hold it without pause(), whose pending pause setting
             * currentTime would end at once, leaving WebKit holding its
             * ready time (see create()).
             */
            native.startTime = null
            native.currentTime = local
        }

        return true
    }

    /**
     * If no animations are left, write where they got to and cancel the
     * WAAPI animation. Returns whether the group ended.
     */
    const end = () => {
        if (tracks.size) return false

        isEnded = true
        /**
         * The element may have a newer group if this one was detached
         * (see handOffElementState).
         */
        getGroup(element) === group && transformGroups.delete(element)
        group.isJS || stop()
        return true
    }

    const build = () => {
        const now = time.now()

        /**
         * Finish the animations that have reached their end, which the
         * WAAPI animation has already rendered.
         */
        if (!group.isJS) {
            group.isFinishing = true
            tracks.forEach((track) => {
                const [trackEnd, trackCycle] = track.timing()

                if (track.state !== "running" || track.scrollTimeline) return

                const { speed } = track

                if (speed > 0 && !trackCycle && trackEnd <= now + 1) {
                    track.complete()
                } else if (speed < 0 && track.at(now) <= 1) {
                    /**
                     * Played backwards, it finishes at its start.
                     */
                    track.tick(now - track.at(now) / speed)
                } else {
                    return
                }

                /**
                 * From now it's checked for outside writes like any other
                 * static transform. If the WAAPI animation never rendered
                 * it (it was instant), rebuild with its value.
                 */
                statics[track.name] = read(owner, track.name)
                built.has(track) || (needsBuild = true)
            })
            group.isFinishing = false
        }

        isScheduled = false

        if (isEnded) return

        tracks.forEach((track) => hasEnded(track) && tracks.delete(track))

        if (end()) return

        let timeline: TimelineWithFallback | undefined | false = false
        for (const track of tracks) {
            if (!track.canAccelerate) return group.demote(true)

            /**
             * Animations that follow different timelines, or none, can't
             * share a WAAPI animation.
             */
            const { scrollTimeline } = track
            if (timeline === false) {
                timeline = scrollTimeline
            } else if (scrollTimeline !== timeline) {
                return group.demote(true)
            }
        }

        /**
         * Everything that kept the group on the main thread has finished,
         * so move the remaining animations back to the compositor.
         */
        if (group.isJS) {
            group.isJS = false
            needsBuild = true
            tracks.forEach((track) => track.stopJS())
        }

        const shouldBuild = needsBuild
        const churned = hasChurned
        needsBuild = hasChurned = false

        if (timeline) return buildScroll(timeline)

        if (shouldBuild || !retime(now, churned)) {
            if (churned) {
                if (now - lastChurn < churnWindow) return group.demote()
                lastChurn = now
            }
            /**
             * Timing that isn't shared runs on the main thread until it
             * is again, as when a value joining a loop ends.
             */
            if (!animate(now)) return group.demote(true)
        } else if (buildAt !== undefined && !churned) {
            /**
             * Still waiting to build, so the values still hold where
             * they start.
             */
            return
        }

        /**
         * Held animations don't move, so set their motion values to where
         * they're held, as a JSAnimation would on its next tick. Pausing
         * and seeking schedule this, so it's once however many there are.
         */
        tracks.forEach(
            (track) => track.timing()[0] === Infinity && track.sync()
        )
    }

    const group: TransformGroup = {
        tracks,
        isJS: false,
        isFinishing: false,

        scrollTime(track) {
            const progress =
                !group.isJS &&
                scrollAnimation?.effect?.getComputedTiming().progress

            return typeof progress === "number"
                ? progress * track.iterationDuration * 1000
                : undefined
        },

        schedule(build_: boolean, isChurn?: boolean) {
            if (isEnded) return

            needsBuild ||= build_
            hasChurned ||= !!isChurn

            /**
             * Build in this frame's render step, so it's in place before
             * anything reads the DOM in postRender, or straight after the
             * current task outside of a frame.
             */
            if (!isScheduled) {
                isScheduled = true
                frameData.isProcessing
                    ? frame.render(build, false, true)
                    : buildSoon(build)
            }
        },

        /**
         * End the group now, rather than when it next builds, so the
         * element's transform is the caller's again as soon as its last
         * animation is stopped.
         */
        release(track) {
            /**
             * Only drop the stopped animation. Others can be idle because
             * they're part way through play(), and are about to run.
             */
            hasEnded(track) && tracks.delete(track)
            end() || group.schedule(true)
        },

        /**
         * An outside write. Rebuild once, but if it keeps happening, move
         * to the main thread.
         */
        check() {
            if (group.isJS) return

            for (const key in statics) {
                if (read(owner, key) !== statics[key] && !has(key)) {
                    return group.schedule(true, true)
                }
            }
        },

        demote(canReturn?: boolean) {
            if (group.isJS || isEnded) return

            /**
             * Unless only another animation is holding the group on the
             * main thread, these animations stay there until they end.
             */
            tracks.forEach((track) => {
                track.isAccelerated() && track.sync()
                canReturn || (track.canAccelerate = false)
            })

            group.isJS = true
            built = new Map()

            stop()
            scrollAnimation = undefined

            tracks.forEach(
                (track) => track.state === "running" && track.js?.start()
            )

            /**
             * Values on a native scroll timeline follow it from JS instead.
             */
            tracks.forEach((track) => track.scrollTimeline && track.observe())

            return true
        },
    }

    transformGroups.set(element, group)

    return group
}
