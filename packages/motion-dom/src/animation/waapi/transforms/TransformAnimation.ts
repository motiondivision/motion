import {
    BezierDefinition,
    clamp,
    EasingFunction,
    easingDefinitionToFunction,
    isBezierDefinition,
    isEasingArray,
    millisecondsToSeconds,
    progress,
} from "motion-utils"
import { frame } from "../../../frameloop/frame"
import { frameData } from "../../../frameloop/frame-data"
import { time } from "../../../frameloop/sync-time"
import {
    isDefaultTransform,
    transformFunction,
} from "../../../render/html/utils/build-transform"
import type { ResolvedValues } from "../../../render/types"
import { transformPropOrder } from "../../../render/utils/keys-transform"
import { mixNumber } from "../../../utils/mix/number"
import type { MotionValue, Owner } from "../../../value"
import { frameloopDriver } from "../../drivers/frame"
import { Driver, DriverControls } from "../../drivers/types"
import { keyframes as keyframesGenerator } from "../../generators/keyframes"
import { defaultOffset } from "../../keyframes/offsets/default"
import { JSAnimation, round } from "../../JSAnimation"
import { sampleDelta } from "../../NativeAnimationExtended"
import {
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "../../types"
import { cubicBezierAsString } from "../easing/cubic-bezier"
import { supportedWaapiEasing } from "../easing/supported"
import { supportsWaapi } from "../supports/waapi"
import { needsMixer } from "../utils/needs-mixer"
import { supportsLinearEasing } from "../../../utils/supports/linear-easing"
import { TransformGroupHooks, transformGroups } from "./groups"

/**
 * Independent transforms (x, y, scale, rotate etc) all write to the one
 * `transform` style, so they can't each run as their own WAAPI animation.
 * Instead, every transform animation on an element joins a group. While
 * every animation in the group can be accelerated, the group composes them
 * into a single `transform` WAAPI animation. The animations stay
 * JSAnimations, but their driver doesn't tick, so they do no work per
 * frame.
 *
 * When every animation follows the same eased progress, which is the case
 * for values that share a transition, the WAAPI animation has just two
 * keyframes and that easing. Otherwise it has as few sampled keyframes
 * as keep it accurate. It's only rebuilt when an animation starts or
 * stops. Pausing, seeking and speed changes that apply to every animation
 * in the group are made to the WAAPI animation, and animations complete
 * on its finish events.
 *
 * If one of them can't be accelerated, or something else keeps writing
 * the element's transform, the whole group moves to the main thread.
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

interface TransformGroup extends TransformGroupHooks {
    tracks: Set<TransformAnimation<any>>

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
    release(track: TransformAnimation<any>): void
    demote(canReturn?: boolean): true | void
}

/**
 * Where each animation was when the WAAPI animation was built: its time,
 * speed and whether it was held.
 */
type BuiltState = [number, number, boolean]

interface Segment {
    animation: Animation
    /**
     * When this starts and ends, relative to when the group was built.
     */
    offset: number
    end: number
    isDone?: boolean
}

/**
 * Sample at the interruption sampling rate, up to a cap for long
 * animations.
 */
const maxSamples = 200

/**
 * How far values may stray from the WAAPI animation: as a fraction of
 * each value's change when they share an easing, otherwise in px or deg,
 * or for scale.
 */
const easingTolerance = 0.001
const sampleTolerance = 0.1
const scaleTolerance = 0.001

/**
 * If an outside write, or a seek the WAAPI animation can't follow,
 * happens again within this window, the group is being driven every
 * frame (scrubbing, drag), which is cheaper on the main thread than
 * rebuilding the WAAPI animation every frame.
 */
const churnWindow = 100

/**
 * A WAAPI animation that starts moving later than this, as most segments
 * of a long sequence do, is built this long before it starts, rather than
 * all at once at the start.
 */
const buildAhead = 100

/**
 * Named easings that are the same cubic-bezier in JS and CSS.
 */
const nativeEasings = new Set(["linear", "easeIn", "easeOut", "easeInOut"])
const isNativeEasing = (ease: unknown): ease is "linear" =>
    nativeEasings.has(ease as string)

/**
 * The last trace of each easing WAAPI can't run into linear(), with its
 * number of samples, so the elements of a sequence that share an easing
 * and duration trace it once.
 */
const traced = new WeakMap<EasingFunction, [number, string]>()

const trace = (ease: EasingFunction, samples: number) => {
    let last = traced.get(ease)
    if (last?.[0] !== samples) {
        last = [
            samples,
            "linear(" +
                defaultOffset(Array(samples + 1)).map(
                    (p) => round(ease(p)) + " " + round(p * 100) + "%"
                ) +
                ")",
        ]
        traced.set(ease, last)
    }
    return last[1]
}

/**
 * How many samples trace an easing between two timestamps.
 */
const countSamples = (from: number, to: number) =>
    Math.min(maxSamples, Math.max(2, Math.ceil((to - from) / sampleDelta)))

/**
 * Whether two eased progresses match. False if either is NaN.
 */
const isNear = (a: number, b: number) => Math.abs(a - b) <= easingTolerance

const byTime = (a: number, b: number) => a - b

/**
 * n + 1 evenly spaced timestamps, from one timestamp to another.
 */
const spread = (from: number, to: number, n: number) =>
    defaultOffset(Array(n + 1)).map((p) => mixNumber(from, to, p))

const getOwner = (options: ValueAnimationOptions<any>) =>
    options.motionValue!.owner as TransformOwner

const getGroup = (element: Element) =>
    transformGroups.get(element) as TransformGroup | undefined

/**
 * Whether an animation has ended, so can leave its group.
 */
const hasEnded = ({ state }: TransformAnimation<any>) =>
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
    transformPropOrder.includes(name) &&
    motionValue?.owner?.current instanceof HTMLElement &&
    supportsWaapi() &&
    supportsLinearEasing()

function canAccelerateTransform(options: ValueAnimationOptions<any>) {
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
        private update: (timestamp: number) => void,
        private makeDriver: Driver,
        public animation?: TransformAnimation<any>
    ) {}

    get js() {
        return (this.driver ||= this.makeDriver(this.update))
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
            : group.schedule(false, !keepAlive)
    }

    stopJS() {
        this.driver?.stop()
    }

    stop() {
        this.stopJS()
        const group = getGroup(this.element)
        group && !group.isFinishing && group.release(this.animation!)
    }
}

/**
 * JSAnimation's time setter, looked up on first use rather than at module
 * load, so the module has no top-level side effects and stays
 * tree-shakeable in flattened bundles.
 */
let setTime: ((this: JSAnimation<any>, time: number) => void) | undefined

export class TransformAnimation<
    T extends number | string
> extends JSAnimation<T> {
    canAccelerate: boolean

    constructor(options: ValueAnimationOptions<T>) {
        const element = getOwner(options).current
        const { driver = frameloopDriver } = options
        let animation: TransformAnimation<T> | undefined

        /**
         * Before JSAnimation replaces the type with its generator.
         */
        const canAccelerate = canAccelerateTransform(options)

        /**
         * The driver ticks on the main thread only once the group has
         * moved there, so its frame loop driver is made then.
         */
        options.driver = (update) =>
            new TransformDriver(element, update, driver, animation)

        super(options)

        animation = this
        /**
         * The first driver is made in super(), before this was assigned.
         */
        const firstDriver = this.driver as TransformDriver | undefined
        firstDriver && (firstDriver.animation = this)
        this.canAccelerate = canAccelerate

        /**
         * stop is bound in JSAnimation, so wrap it rather than override.
         * Before stopping, set the motion value to where the WAAPI
         * animation is now, with velocity, for the next animation to
         * start from.
         */
        const { stop } = this
        this.stop = () => {
            this.isAccelerated() && this.sync()
            stop()
        }
    }

    private offsetsOf?: unknown[]
    private cachedOffsets?: number[]

    /**
     * Each keyframe's offset, made once for the keyframes rather than on
     * every build.
     */
    offsets() {
        const { keyframes, times } = this.options
        if (times) return times
        if (this.offsetsOf !== keyframes) {
            this.offsetsOf = keyframes
            this.cachedOffsets = defaultOffset(keyframes)
        }
        return this.cachedOffsets!
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
    isAccelerated() {
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
     * If this moves between two keyframes only, holding still either side
     * of them, as each value of a sequence segment does, when it starts
     * and stops moving, and its easing: as a string if WAAPI runs it
     * exactly, otherwise its function, to trace.
     */
    tween(): [number, number, (string | EasingFunction)?] | undefined {
        const { keyframes, type, repeat, delay = 0 } = this.options
        let span = -1

        if (repeat || type !== keyframesGenerator || this.holdTime !== null) {
            return
        }

        for (let i = 1; i < keyframes.length; i++) {
            if (keyframes[i] !== keyframes[i - 1]) {
                if (span >= 0) return
                span = i - 1
            }
        }

        let { ease } = this.options
        if (isEasingArray(ease)) ease = ease[span]

        const offsets = this.offsets()
        const at = (i: number) =>
            this.startTime! +
            (delay + offsets[i] * this.totalDuration) / this.speed

        if (span >= 0) {
            const easing = isBezierDefinition(ease!)
                ? cubicBezierAsString(ease as BezierDefinition)
                : isNativeEasing(ease)
                ? supportedWaapiEasing[ease]
                : easingDefinitionToFunction(ease!)

            /**
             * An easing that doesn't run from 0 to 1 doesn't move between
             * the keyframes, so is traced from the values it gives instead.
             */
            return [
                at(span),
                at(span + 1),
                typeof easing === "string" ||
                (isNear(easing(0), 0) && isNear(easing(1), 1))
                    ? easing
                    : undefined,
            ]
        }
    }

    /**
     * The timestamps between two timestamps where this reaches a
     * keyframe or starts a repeat, where it can turn or jump.
     */
    boundaries(from: number, to: number) {
        const { startTime, speed, resolvedDuration, options } = this
        const {
            delay = 0,
            repeat = 0,
            repeatDelay = 0,
            repeatType,
            type,
        } = options
        const offsets =
            (type || keyframesGenerator) === keyframesGenerator
                ? this.offsets()
                : [0, 1]
        const start = startTime! + delay / speed
        const result: number[] = []

        if (this.holdTime !== null || !(resolvedDuration > 0)) return result

        for (
            let i = Math.max(
                0,
                Math.floor(((from - start) * speed) / resolvedDuration)
            );
            i <= repeat;
            i++
        ) {
            const iterationStart = start + (i * resolvedDuration) / speed
            if (iterationStart > to) break

            for (const offset of offsets) {
                const t =
                    iterationStart +
                    ((i % 2 && repeatType && repeatType !== "loop"
                        ? 1 - offset
                        : offset) *
                        (resolvedDuration - repeatDelay)) /
                        speed
                t > from && t < to && result.push(t)
            }
        }

        return result
    }

    /**
     * The value at a timestamp, as a number.
     */
    numberAt(timestamp: number) {
        return parseFloat(this.sampleAt(timestamp, true) as string)
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
        /**
         * A stopped animation (one that was interrupted) can't play again,
         * so it mustn't join the group.
         */
        if (this.isStopped) return
        ;(this.group || createGroup(getOwner(this.options))).tracks.add(this)

        super.play()
    }

    pause() {
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
        ;(setTime ??= Object.getOwnPropertyDescriptor(
            JSAnimation.prototype,
            "time"
        )!.set!).call(this, newTime)
    }

    /**
     * Scroll timelines set time every frame, so run these on the main
     * thread.
     */
    attachTimeline(timeline: TimelineWithFallback) {
        this.canAccelerate = false
        this.group?.demote(true)
        return super.attachTimeline(timeline)
    }
}

/**
 * Groups that build straight after the current task build in one
 * microtask, rather than one each.
 */
let builds: VoidFunction[] | undefined

const buildSoon = (build: VoidFunction) => {
    builds ||
        queueMicrotask(() => {
            const queue = builds!
            builds = undefined
            queue.forEach((build) => build())
        })
    ;(builds ||= []).push(build)
}

function createGroup(owner: TransformOwner): TransformGroup {
    const element = owner.current
    const tracks = new Set<TransformAnimation<any>>()
    const byKey = new Map<string, TransformAnimation<any>>()

    /**
     * Transforms that aren't animating, as built into the WAAPI animation.
     */
    let statics: Record<string, AnyResolvedKeyframe | undefined> = {}
    /**
     * The transforms in the WAAPI animation, in order.
     */
    let keys: string[] = []
    let built = new Map<TransformAnimation<any>, BuiltState>()
    let segments: Segment[] = []
    let needsBuild = false
    let isScheduled = false
    let isEnded = false
    let hasChurned = false
    let lastChurn = -Infinity
    let wake: ReturnType<typeof setTimeout> | undefined

    const has = (key: string) => {
        for (const track of tracks) if (track.name === key) return true
    }

    /**
     * The transform values at a timestamp or, without one, from the
     * motion values. Animations that don't repeat forever are sampled no
     * earlier than settled, so a loop that starts from an earlier cycle
     * boundary holds them at their end.
     */
    const valuesAt = (timestamp?: number, settled?: number) => {
        const values: ResolvedValues = {}
        for (const key of timestamp === undefined ? transformPropOrder : keys) {
            const track = byKey.get(key)
            const value =
                timestamp === undefined
                    ? read(owner, key)
                    : track
                    ? track.sampleAt(
                          settled! > timestamp && !track.timing()[1]
                              ? settled!
                              : timestamp
                      )
                    : statics[key]

            if (value !== undefined) values[key] = value
        }
        return values
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
     * Build the transform at a timestamp.
     */
    const compose = (timestamp: number, settled?: number) =>
        toTransform(valuesAt(timestamp, settled))

    /**
     * Write the transform as an inline style, as the renderer would.
     */
    const commit = (values = valuesAt()) => {
        element.style.transform = toTransform(values, true)
    }

    /**
     * Cancel a WAAPI animation and remove its handlers, as WebKit never
     * collects an animation once it has run, nor anything its handlers
     * reference (#4034).
     */
    const cancel = (animation: Animation) => {
        animation.onfinish = animation.oncancel = null
        animation.cancel()
    }

    /**
     * Cancel the WAAPI animations, by default first committing the
     * transform. The renderer writes its own version on its next render.
     */
    const stop = (shouldCommit = true) => {
        clearTimeout(wake)
        shouldCommit && commit()
        segments.forEach(({ animation }) => cancel(animation))
        segments = []
    }

    /**
     * A WAAPI animation that add() starts by setting its startTime. Playing
     * it first, as element.animate() does, would leave WebKit holding that
     * play's ready time once startTime ends the play, and it uses that for
     * the next updatePlaybackRate(), so the animation would jump.
     */
    const create = (
        keyframes: PropertyIndexedKeyframes | null,
        options: KeyframeAnimationOptions
    ) =>
        new Animation(
            new KeyframeEffect(element, keyframes, options) as AnimationEffect
        )

    const add = (animation: Animation, offset: number, end = Infinity) => {
        const segment: Segment = { animation, offset, end }
        animation.startTime = time.now() + offset

        /**
         * Animations finish when the WAAPI animation reaches their end.
         * Once a loop has taken over, the finished animation isn't needed.
         */
        if (end < Infinity) {
            animation.onfinish = () => {
                segment.isDone = true
                if (segments.some((s) => s.end === Infinity)) {
                    cancel(animation)
                    segments = segments.filter((s) => s !== segment)
                }
                group.schedule(false)
            }
        }

        /**
         * Something else cancelled it, so carry on on the main thread.
         */
        animation.oncancel = () => segments.includes(segment) && group.demote()

        segments.push(segment)
    }

    /**
     * Where a value jumps between two timestamps, as when a repeat starts
     * again: the timestamps either side of the jump, or none if it moves
     * there continuously.
     */
    const jumpAt = (value: (t: number) => number, a: number, b: number) => {
        const change = (x: number, y: number) => Math.abs(value(y) - value(x))
        const size = change(a, b)
        while (b - a > 0.01) {
            const mid = (a + b) / 2
            change(a, mid) > change(mid, b) ? (b = mid) : (a = mid)
        }
        return change(a, b) > size / 2 ? [a, b] : []
    }

    /**
     * If every moving animation follows the same eased progress between
     * two timestamps, the easing that describes it.
     */
    const getEasing = (
        moving: TransformAnimation<any>[],
        from: number,
        to: number,
        bounds: number[]
    ) => {
        const samples = countSamples(from, to)

        /**
         * Too many keyframes or repeats to follow with this many samples.
         */
        if (bounds.length * 4 > samples) return

        /**
         * First check half way, where values with different easings
         * usually differ, before sampling every value many times.
         */
        let quick: number | undefined
        for (const track of moving) {
            const first = track.numberAt(from)
            const p =
                (track.numberAt((from + to) / 2) - first) /
                (track.numberAt(to) - first)

            /**
             * NaN if it doesn't move.
             */
            if (p !== p) continue
            if (quick === undefined) quick = p
            else if (!isNear(p, quick)) return
        }

        const at = spread(from, to, samples).concat(bounds).sort(byTime)

        const position = (t: number) => progress(from, to, t)
        let shared: number[] | undefined
        let progressAt: (t: number) => number

        for (const track of moving) {
            const first = track.numberAt(from)
            const changes = at.map((t) => track.numberAt(t) - first)
            const end = changes[changes.length - 1]

            /**
             * A value that ends only a tiny way from where it started, as
             * a round trip does if it's built just after it starts, or
             * from a float residue, ends where it started. Dividing by
             * that tiny range would stretch the easing to values the
             * compositor can't render.
             */
            const range = changes.some(
                (change) => Math.abs(change) * easingTolerance > Math.abs(end)
            )
                ? 0
                : end

            const progress = changes.map((change) =>
                range ? change / range : change
            )

            /**
             * The first value that moves sets the easing, and every other
             * one must follow it. A value that doesn't change, like one
             * still in its delay, fits any easing. One that changes but
             * ends where it started fits none.
             */
            if (range && !shared) {
                shared = progress
                progressAt = (t) => (track.numberAt(t) - first) / range
            } else if (
                progress.some((p, i) => !isNear(p, range && shared![i]))
            ) {
                return
            }
        }

        if (!shared || shared.every((p, i) => isNear(p, position(at[i])))) {
            return "linear"
        }

        /**
         * A repeat that starts again jumps back, which takes two points at
         * the same position.
         */
        const points: string[] = []
        const point = (t: number, p = progressAt(t)) =>
            points.push(round(p) + " " + round(position(t) * 100) + "%")
        shared.forEach((p, i) => {
            i &&
                Math.abs(p - shared![i - 1]) > 0.2 &&
                jumpAt(progressAt, at[i - 1], at[i]).forEach((t) => point(t))
            point(at[i], p)
        })

        return "linear(" + points + ")"
    }

    /**
     * Sample timestamps between two timestamps, closer together where the
     * moving animations curve.
     */
    const sample = (
        moving: TransformAnimation<any>[],
        from: number,
        to: number,
        bounds: number[]
    ) => {
        const times = [from]

        /**
         * A linear tween is straight between its keyframes, so only the
         * other values can curve, and a tween only while it moves.
         */
        const curved: TransformAnimation<any>[] = []
        let curveFrom = to
        let curveTo = from
        for (const track of moving) {
            const tween = track.tween()
            if (tween?.[2] !== "linear") {
                const [trackEnd, cycle] = track.timing()
                const [a, b] = tween || [from, cycle ? to : trackEnd]
                curveFrom = Math.min(curveFrom, a)
                curveTo = Math.max(curveTo, b)
                curved.push(track)
            }
        }
        curveFrom = Math.max(from, curveFrom)
        curveTo = Math.min(to, curveTo)

        /**
         * Values that aren't numbers, like calc(), are left to the
         * browser to interpolate.
         */
        const isStraight = (a: number, b: number) =>
            curved.every(
                (track) =>
                    !(
                        Math.abs(
                            track.numberAt((a + b) / 2) -
                                (track.numberAt(a) + track.numberAt(b)) / 2
                        ) >
                        (track.name.startsWith("scale")
                            ? scaleTolerance
                            : sampleTolerance)
                    )
            )

        const split = (a: number, b: number, depth: number) => {
            if (b - a < 1 || isStraight(a, b)) {
                times.push(b)
            } else if (depth < 4) {
                split(a, (a + b) / 2, depth + 1)
                split((a + b) / 2, b, depth + 1)
            } else {
                /**
                 * Keyframes either side of a jump, like a repeat starting
                 * again, so it doesn't play as a quick sweep.
                 */
                for (const track of moving) {
                    times.push(...jumpAt((t) => track.numberAt(t), a, b))
                }
                times.push(b)
            }
        }

        /**
         * Split at least every 100ms where a value can curve, and at every
         * keyframe and repeat, either side of where a value can jump.
         */
        const ends =
            curveTo > curveFrom
                ? spread(
                      curveFrom,
                      curveTo,
                      Math.ceil((curveTo - curveFrom) / 100)
                  )
                : []
        ends.push(to)
        for (const t of bounds) ends.push(t, Math.min(t + 0.01, to))

        let start = from
        for (const end of ends.sort(byTime)) {
            end > start && split(start, end, 0)
            start = end
        }

        return times.sort(byTime)
    }

    /**
     * If every moving animation is the same tween, started together, as
     * happens for the values of one animate() call or transition, when
     * they move and their native easing.
     */
    const getTween = (moving: TransformAnimation<any>[]) => {
        let shared: [number, number, (string | EasingFunction)?] | undefined

        for (const track of moving) {
            const tween = track.tween()
            if (
                !tween ||
                (shared &&
                    (Math.abs(tween[0] - shared[0]) > 1 ||
                        Math.abs(tween[1] - shared[1]) > 1))
            ) {
                return
            }
            /**
             * Easings that differ, like the springs a sequence makes for
             * each value, can still be the same curve.
             */
            shared = [
                tween[0],
                tween[1],
                !shared || tween[2] === shared[2] ? tween[2] : undefined,
            ]
        }

        return shared
    }

    /**
     * A WAAPI animation of the composed transform between two timestamps.
     */
    const run = (
        moving: TransformAnimation<any>[],
        from: number,
        to: number,
        nativeEasing?: string,
        options: KeyframeAnimationOptions = { fill: "both" },
        settled?: number
    ) => {
        /**
         * With an easing given, there's nothing to sample, so no need
         * for the boundaries.
         */
        const bounds = nativeEasing
            ? []
            : moving.flatMap((track) => track.boundaries(from, to))
        const easing = nativeEasing || getEasing(moving, from, to, bounds)
        const times = easing ? [from, to] : sample(moving, from, to, bounds)
        const transform = times.map((t) => compose(t, settled))
        let keyframes: PropertyIndexedKeyframes | null = { transform }
        if (!easing) {
            keyframes.offset = times.map((t) => progress(from, to, t))
        }

        /**
         * If nothing moves, don't hold a transform, which, even at its
         * default, would make the element a containing block. The empty
         * animation still finishes the animations.
         */
        if (transform.every((t) => t === transform[0])) {
            commit(valuesAt(from, settled))
            keyframes = null
        }

        return create(keyframes, {
            ...options,
            duration: to - from,
            easing: easing || "linear",
        })
    }

    /**
     * Replace the WAAPI animations with ones built from now. Returns
     * undefined if the animations can't be composed.
     */
    const animate = (now: number) => {
        /**
         * The finite part runs until the last finite animation (or the
         * last delay) ends. Infinitely repeating animations then continue
         * as one looping WAAPI animation, which needs them to share a
         * cycle.
         */
        let end = now
        let cycle = 0
        let cycleStart = 0
        const moving: TransformAnimation<any>[] = []
        const looping: TransformAnimation<any>[] = []
        const ends = new Set<number>()

        byKey.clear()
        built = new Map()

        for (const track of tracks) {
            byKey.set(track.name, track)

            const [trackEnd, trackCycle] = track.timing()
            const isHeld = trackEnd === Infinity

            built.set(track, [track.at(now), track.speed, isHeld])

            if (isHeld) continue

            if (track.speed < 0) return

            if (trackCycle) {
                if (cycle) {
                    const phase = (trackEnd - cycleStart) / trackCycle
                    if (
                        Math.abs(trackCycle - cycle) > 1 ||
                        Math.abs(phase - Math.round(phase)) * cycle > 1
                    ) {
                        return
                    }
                } else {
                    cycle = trackCycle
                    cycleStart = trackEnd
                }
                looping.push(track)
            } else {
                ends.add(trackEnd)
            }

            moving.push(track)
            end = Math.max(end, trackEnd)
        }

        statics = {}
        /**
         * Transforms that aren't animating are left out at their default.
         */
        keys = transformPropOrder.filter((key) => {
            if (byKey.has(key)) return true
            const value = (statics[key] = read(owner, key))
            return value !== undefined && !isDefaultTransform(key, value)
        })

        stop(false)

        /**
         * Values that share one tween are one WAAPI animation of it, with
         * two keyframes and its own easing, from when they started.
         */
        const tween = !cycle && getTween(moving)

        try {
            if (end > now) {
                let easing: string | undefined

                if (tween && tween[1] > now) {
                    const [from, to, ease] = tween

                    /**
                     * Until it's built, the motion values hold where it
                     * starts, for the renderer to write.
                     */
                    if (from - now > buildAhead) {
                        moving.forEach((track) => track.sync())
                        wake = setTimeout(
                            () => group.schedule(true),
                            from - now - buildAhead
                        )
                        return true
                    }

                    easing =
                        typeof ease === "string"
                            ? ease
                            : ease
                            ? trace(ease, countSamples(from, to))
                            : getEasing(moving, from, to, [])

                    /**
                     * It holds its last keyframe until the animations end.
                     */
                    easing &&
                        add(
                            run(moving, from, to, easing, {
                                fill: "both",
                                endDelay: end - to,
                            }),
                            from - now,
                            end - from
                        )
                }

                easing || add(run(moving, now, end), 0, end - now)

                /**
                 * Animations that end sooner finish on the events of
                 * empty animations that end with them.
                 */
                ends.forEach(
                    (trackEnd) =>
                        trackEnd < end - 1 &&
                        add(
                            create(null, { duration: trackEnd - now }),
                            0,
                            trackEnd - now
                        )
                )
            }

            if (cycle) {
                /**
                 * Build one cycle from a cycle boundary, so it repeats
                 * seamlessly, and start it part way through.
                 */
                const from =
                    cycleStart + Math.floor((end - cycleStart) / cycle) * cycle

                add(
                    run(
                        looping,
                        from,
                        from + cycle,
                        undefined,
                        {
                            iterations: Infinity,
                            iterationStart: (end - from) / cycle,
                            /**
                             * It must not fill backwards over the finite part
                             * that runs before it.
                             */
                            fill: "forwards",
                        },
                        end
                    ),
                    end - now
                )
            }
        } catch {
            return
        }

        /**
         * Everything is held, so hold it with an inline style instead.
         */
        segments.length || stop()

        return true
    }

    /**
     * If every animation has been paused, played, seeked or sped up
     * together since the WAAPI animation was built, do the same to it.
     * Returns false if it needs rebuilding instead.
     */
    const retime = (now: number) => {
        let elapsed: number | undefined
        let rate = 0

        for (const track of tracks) {
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
                if (isHeld && (trackTime === builtTime || !segments.length)) {
                    continue
                }
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

        if (elapsed === undefined) return true
        if (!segments.length) return false

        for (const { offset, end, isDone } of segments) {
            const local = elapsed - offset
            if (
                end < Infinity &&
                (isDone ? local < end - 1 : local < 0 || local >= end)
            ) {
                return false
            }
        }

        for (const { animation, offset, isDone } of segments) {
            if (isDone) continue

            const local = elapsed - offset
            if (
                rate &&
                animation.updatePlaybackRate &&
                animation.playState === "running" &&
                Math.abs(Number(animation.currentTime) - local) < 20
            ) {
                /**
                 * Only the speed changed. Setting playbackRate and
                 * startTime restarts a running compositor animation, which
                 * can render the underlying value for a frame.
                 */
                animation.playbackRate !== rate &&
                    animation.updatePlaybackRate(rate)
            } else if (rate) {
                animation.playbackRate = rate
                animation.startTime = now - local / rate
            } else {
                /**
                 * Hold it without pause(), whose pending pause setting
                 * currentTime would end at once, leaving WebKit holding its
                 * ready time (see create()).
                 */
                animation.startTime = null
                animation.currentTime = local
            }
        }

        return true
    }

    /**
     * If no animations are left, write where they got to and cancel the
     * WAAPI animations. Returns whether the group ended.
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

                if (
                    track.state === "running" &&
                    track.speed > 0 &&
                    !trackCycle &&
                    trackEnd <= now + 1
                ) {
                    track.complete()

                    /**
                     * From now it's checked for outside writes like any
                     * other static transform. If the WAAPI animation never
                     * rendered it (it was instant), rebuild with its value.
                     */
                    statics[track.name] = read(owner, track.name)
                    built.has(track) || (needsBuild = true)
                }
            })
            group.isFinishing = false
        }

        isScheduled = false

        if (isEnded) return

        tracks.forEach((track) => hasEnded(track) && tracks.delete(track))

        if (end()) return

        for (const track of tracks) {
            if (!track.canAccelerate) return group.demote(true)
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

        if (shouldBuild || !retime(now)) {
            if (churned) {
                if (now - lastChurn < churnWindow) return group.demote()
                lastChurn = now
            }
            if (!animate(now)) return group.demote()
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

            tracks.forEach(
                (track) => track.state === "running" && track.js?.start()
            )

            return true
        },
    }

    transformGroups.set(element, group)

    return group
}
