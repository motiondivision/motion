import { clamp, millisecondsToSeconds } from "motion-utils"
import { frame } from "../../../frameloop/frame"
import { frameData } from "../../../frameloop/frame-data"
import { time } from "../../../frameloop/sync-time"
import {
    buildTransform,
    translateAlias,
} from "../../../render/html/utils/build-transform"
import type { ResolvedValues } from "../../../render/types"
import { transformPropOrder } from "../../../render/utils/keys-transform"
import type { MotionValue, Owner } from "../../../value"
import { numberValueTypes } from "../../../value/types/maps/number"
import { getValueAsType } from "../../../value/types/utils/get-as-type"
import { frameloopDriver } from "../../drivers/frame"
import { DriverControls } from "../../drivers/types"
import { JSAnimation } from "../../JSAnimation"
import {
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "../../types"
import { supportsWaapi } from "../supports/waapi"
import { transformGroups } from "./groups"

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

interface TransformGroup {
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

    schedule(needsBuild: boolean): void
    seek(): void
    check(): void
    demote(canReturn?: boolean): void
}

/**
 * Where each animation was when the WAAPI animation was built.
 */
interface BuiltState {
    time: number
    speed: number
    isHeld: boolean
}

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
 * Sample every 10ms, matching the interruption sampling in
 * NativeAnimationExtended, up to a cap for long animations.
 */
const sampleDelta = 10
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

const round = (value: number) => Math.round(value * 10000) / 10000

const noop = () => {}
const noopDriver = () => ({ start: noop, stop: noop, now: time.now })

const getOwner = (options: ValueAnimationOptions<any>) =>
    options.motionValue!.owner as TransformOwner

const getGroup = (element: Element) =>
    transformGroups.get(element) as TransformGroup | undefined

const read = (owner: TransformOwner, key: string) =>
    owner.latestValues ? owner.latestValues[key] : owner.getValue(key)?.get()

/**
 * Whether this animation should join its element's transform group.
 * Animations that can't be accelerated still join, so the group knows
 * to stay on the main thread while they run.
 */
export const canGroupTransform = ({
    name,
    motionValue,
}: ValueAnimationOptions<any>) =>
    Boolean(
        name &&
            transformPropOrder.includes(name) &&
            motionValue?.owner?.current instanceof HTMLElement &&
            supportsWaapi()
    )

export function canAccelerateTransform(options: ValueAnimationOptions<any>) {
    const owner = getOwner(options)
    const { onUpdate, transformTemplate } = owner.getProps()

    return (
        /**
         * onUpdate needs every value, every frame.
         */
        !onUpdate &&
        /**
         * transformTemplate could output anything.
         */
        !transformTemplate &&
        options.type !== "inertia" &&
        /**
         * A literal transform, or pathRotation, replaces or adds to the
         * transform we'd build.
         */
        !owner.latestValues?.transform &&
        !read(owner, "pathRotation") &&
        /**
         * Layout animations write transform every frame.
         */
        !owner.projection?.isProjecting()
    )
}

export class TransformAnimation<
    T extends number | string
> extends JSAnimation<T> {
    canAccelerate: boolean

    private sampler?: JSAnimation<T>

    constructor(options: ValueAnimationOptions<T>, canAccelerate: boolean) {
        const element = getOwner(options).current

        /**
         * The driver ticks on the main thread only once the group has
         * moved there. Until then, starting or stopping tells the group to
         * update its WAAPI animation.
         */
        options.driver = (update) => {
            const js = frameloopDriver(update)

            return {
                js,
                now: js.now,
                start: (keepAlive = true) => {
                    const group = getGroup(element)
                    const isJS = !group || group.isJS

                    /**
                     * keepAlive is false when seeking.
                     */
                    isJS
                        ? js.start(keepAlive)
                        : keepAlive
                        ? group.schedule(false)
                        : group.seek()
                },
                stop: () => {
                    js.stop()
                    const group = getGroup(element)
                    group?.schedule(!group.isFinishing)
                },
            } as TransformDriverControls
        }

        super(options)

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

    get group() {
        return getGroup(getOwner(this.options).current)
    }

    get js() {
        return (this.driver as TransformDriverControls | undefined)?.js
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
        return Boolean(
            group &&
                !group.isJS &&
                this.canAccelerate &&
                (state === "running" || state === "paused")
        )
    }

    /**
     * This animation's time, including delay, at a timestamp.
     */
    at(timestamp: number) {
        return (
            this.holdTime ?? round((timestamp - this.startTime!) * this.speed)
        )
    }

    /**
     * The value at a timestamp, without changing this animation's state.
     */
    sampleAt(timestamp: number) {
        this.sampler ||= new JSAnimation({
            ...this.options,
            autoplay: false,
            driver: noopDriver,
            onUpdate: undefined,
            onComplete: undefined,
            onPlay: undefined,
            onStop: undefined,
            onCancel: undefined,
        })

        return this.sampler.sample(this.at(timestamp)).value
    }

    /**
     * The value at a timestamp, as a number.
     */
    numberAt(timestamp: number) {
        return parseFloat(this.sampleAt(timestamp) as string)
    }

    /**
     * Write the current value, and velocity, to the motion value.
     */
    sync() {
        const now = time.now()
        this.options.motionValue!.setWithVelocity(
            this.sampleAt(now - sampleDelta),
            this.sampleAt(now),
            sampleDelta
        )
    }

    play() {
        const owner = getOwner(this.options)
        let { group } = this

        if (!group) {
            group = createGroup(owner)
            transformGroups.set(owner.current, group)
        }
        group.tracks.add(this)

        super.play()
    }

    pause() {
        super.pause()

        if (this.isAccelerated()) {
            this.sync()
            this.group!.schedule(false)
        }
    }

    /**
     * JSAnimation finishes on its next tick, which only happens on the
     * main thread, so finish now.
     */
    complete() {
        super.complete()
        const { group } = this
        group && !group.isJS && this.canAccelerate && this.tick(time.now())
    }

    get time() {
        if (this.isAccelerated() && this.holdTime === null) {
            const { delay = 0 } = this.options
            return millisecondsToSeconds(
                clamp(
                    0,
                    this.totalDuration,
                    (time.now() - this.startTime!) * this.speed - delay
                )
            )
        }

        return super.time
    }

    set time(newTime: number) {
        super.time = newTime
    }

    /**
     * Scroll timelines set time every frame, so run these on the main
     * thread.
     */
    attachTimeline(timeline: TimelineWithFallback) {
        this.canAccelerate = false
        this.group?.demote()
        return super.attachTimeline(timeline)
    }
}

function createGroup(owner: TransformOwner): TransformGroup {
    const element = owner.current
    const tracks = new Set<TransformAnimation<any>>()
    const byKey = new Map<string, TransformAnimation<any>>()

    /**
     * Transforms that aren't animating, as built into the WAAPI animation.
     */
    let statics: Record<string, AnyResolvedKeyframe | undefined> = {}
    let built = new Map<TransformAnimation<any>, BuiltState>()
    let segments: Segment[] = []
    let needsBuild = false
    let isScheduled = false
    let hasChurned = false
    let lastChurn = -Infinity

    const has = (key: string) => {
        for (const track of tracks) if (track.name === key) return true
    }

    /**
     * The transform values at a timestamp or, without one, from the
     * motion values. Animations that don't repeat forever are sampled no
     * earlier than settled, so a loop that starts from an earlier cycle
     * boundary holds them at their end.
     */
    const valuesAt = (timestamp?: number, settled = -Infinity) => {
        const values: ResolvedValues = {}
        for (const key of transformPropOrder) {
            const track = byKey.get(key)
            const value =
                timestamp === undefined
                    ? read(owner, key)
                    : track
                    ? track.sampleAt(
                          track.timing()[1]
                              ? timestamp
                              : Math.max(timestamp, settled)
                      )
                    : statics[key]

            if (value !== undefined) values[key] = value
        }
        return values
    }

    /**
     * Build the transform at a timestamp. Unlike buildTransform, every key
     * is written, even at its default, so each keyframe has the same list
     * of functions and the browser interpolates them one by one.
     */
    const compose = (timestamp: number, settled?: number) => {
        let transform = ""
        const values = valuesAt(timestamp, settled)
        for (const key in values) {
            transform +=
                (translateAlias[key] || key) +
                "(" +
                getValueAsType(values[key], numberValueTypes[key]) +
                ") "
        }
        return transform || "none"
    }

    /**
     * Write the transform as an inline style, as the renderer would.
     */
    const commit = (values = valuesAt()) => {
        element.style.transform = buildTransform(values, {})
    }

    /**
     * Cancel the WAAPI animations, by default first committing the
     * transform. The renderer writes its own version on its next render.
     */
    const stop = (shouldCommit = true) => {
        shouldCommit && commit()
        segments.forEach(({ animation }) => animation.cancel())
        segments = []
    }

    const add = (animation: Animation, offset: number, end = Infinity) => {
        const segment: Segment = { animation, offset, end }
        animation.startTime = time.now() + offset

        /**
         * Animations finish when the WAAPI animation reaches their end.
         */
        if (end < Infinity) {
            animation.onfinish = () => {
                segment.isDone = true
                group.schedule(false)
            }
        }
        segments.push(segment)
    }

    /**
     * If every moving animation follows the same eased progress between
     * two timestamps, the easing that describes it.
     */
    const getEasing = (
        moving: TransformAnimation<any>[],
        from: number,
        to: number
    ) => {
        const samples = Math.min(
            maxSamples,
            Math.max(2, Math.ceil((to - from) / sampleDelta))
        )
        let shared: number[] | undefined

        for (const track of moving) {
            const values: number[] = []
            for (let i = 0; i <= samples; i++) {
                values.push(track.numberAt(from + ((to - from) * i) / samples))
            }

            const [first] = values
            const range = values[samples] - first
            const progress = values.map((value) =>
                range ? (value - first) / range : value - first
            )

            /**
             * A value that doesn't change, like one still in its delay,
             * fits any easing. One that changes but ends where it started
             * fits none.
             */
            if (!range) {
                if (progress.some((p) => !(Math.abs(p) <= easingTolerance))) {
                    return
                }
            } else if (!shared) {
                shared = progress
            } else if (
                progress.some(
                    (p, i) => !(Math.abs(p - shared![i]) <= easingTolerance)
                )
            ) {
                return
            }
        }

        return shared &&
            shared.some((p, i) => Math.abs(p - i / samples) > easingTolerance)
            ? "linear(" + shared.map(round).join(",") + ")"
            : "linear"
    }

    /**
     * Sample timestamps between two timestamps, closer together where the
     * moving animations curve.
     */
    const sample = (
        moving: TransformAnimation<any>[],
        from: number,
        to: number
    ) => {
        const times = [from]

        /**
         * Values that aren't numbers, like calc(), are left to the
         * browser to interpolate.
         */
        const isStraight = (a: number, b: number) =>
            moving.every(
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
            if (depth < 4 && !isStraight(a, b)) {
                split(a, (a + b) / 2, depth + 1)
                split((a + b) / 2, b, depth + 1)
            } else {
                times.push(b)
            }
        }

        const steps = Math.ceil((to - from) / 100)
        for (let i = 0; i < steps; i++) {
            split(
                from + ((to - from) * i) / steps,
                from + ((to - from) * (i + 1)) / steps,
                0
            )
        }

        return times
    }

    /**
     * A WAAPI animation of the composed transform between two timestamps.
     */
    const run = (
        moving: TransformAnimation<any>[],
        from: number,
        to: number,
        options: KeyframeAnimationOptions,
        settled?: number
    ) => {
        const easing = getEasing(moving, from, to)
        const times = easing ? [from, to] : sample(moving, from, to)
        const transform = times.map((t) => compose(t, settled))
        let keyframes: PropertyIndexedKeyframes | null = { transform }
        if (!easing) {
            keyframes.offset = times.map((t) => (t - from) / (to - from))
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

        return element.animate(keyframes, {
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

            built.set(track, {
                time: track.at(now),
                speed: track.speed,
                isHeld,
            })

            /**
             * Held animations don't move, so keep their motion values up
             * to date, as a JSAnimation would on a seek.
             */
            if (isHeld) {
                track.sync()
                continue
            }

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
        for (const key of transformPropOrder) {
            if (!byKey.has(key)) statics[key] = read(owner, key)
        }

        stop(false)

        try {
            if (end > now) {
                add(run(moving, now, end, { fill: "both" }), 0, end - now)

                /**
                 * Animations that end sooner finish on the events of
                 * empty animations that end with them.
                 */
                ends.forEach(
                    (trackEnd) =>
                        trackEnd < end - 1 &&
                        add(
                            element.animate(null, {
                                duration: trackEnd - now,
                            }),
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

            const trackTime = track.at(now)
            const isHeld = track.timing()[0] === Infinity

            if (state.isHeld) {
                if (isHeld && trackTime === state.time) continue
                return false
            }

            const trackElapsed = (trackTime - state.time) / state.speed
            const trackRate = isHeld ? 0 : track.speed / state.speed

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
            if (rate) {
                animation.playbackRate = rate
                animation.startTime = now - local / rate
            } else {
                animation.pause()
                animation.currentTime = local
            }
        }

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
                     * other static transform.
                     */
                    statics[track.name] = read(owner, track.name)
                }
            })
            group.isFinishing = false
        }

        isScheduled = false

        tracks.forEach(({ state }, track) => {
            if (state === "idle" || state === "finished") tracks.delete(track)
        })

        if (!tracks.size) {
            transformGroups.delete(element)
            group.isJS || stop()
            return
        }

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
            tracks.forEach((track) => track.js?.stop())
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
    }

    const group: TransformGroup = {
        tracks,
        isJS: false,
        isFinishing: false,

        schedule(build_: boolean) {
            needsBuild ||= build_

            /**
             * Build in this frame's render step, so it's in place before
             * anything reads the DOM in postRender, or straight after the
             * current task outside of a frame.
             */
            if (!isScheduled) {
                isScheduled = true
                frameData.isProcessing
                    ? frame.render(build, false, true)
                    : queueMicrotask(build)
            }
        },

        /**
         * Seeking the WAAPI animation is free, but if a seek needs a
         * rebuild and keeps happening, move to the main thread.
         */
        seek() {
            hasChurned = true
            group.schedule(false)
        },

        /**
         * An outside write. Rebuild once, but if it keeps happening, move
         * to the main thread.
         */
        check() {
            if (group.isJS) return

            for (const key in statics) {
                if (read(owner, key) !== statics[key] && !has(key)) {
                    hasChurned = true
                    return group.schedule(true)
                }
            }
        },

        demote(canReturn?: boolean) {
            if (group.isJS) return

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
        },
    }

    return group
}
