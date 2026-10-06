import { clamp, millisecondsToSeconds } from "motion-utils"
import { frame } from "../../../frameloop/frame"
import { frameData } from "../../../frameloop/frame-data"
import { time } from "../../../frameloop/sync-time"
import { translateAlias } from "../../../render/html/utils/build-transform"
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
 * every animation in the group can be accelerated, the group samples them
 * all into a single `transform` WAAPI animation, rebuilt whenever one
 * starts, stops, pauses or seeks. The animations stay JSAnimations, but
 * their driver doesn't tick, so they do no work per frame.
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
    churn(): void
    check(): void
    demote(): void
}

/**
 * Sample every 10ms, matching the interruption sampling in
 * NativeAnimationExtended, up to a cap for long animations.
 */
const sampleDelta = 10
const maxSamples = 400

/**
 * If an outside write or seek happens again within this window, the group
 * is being driven every frame (scrubbing, drag), which is cheaper on the
 * main thread than rebuilding the WAAPI animation every frame.
 */
const churnWindow = 100

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
         * rebuild.
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
                        ? group.schedule(true)
                        : group.churn()
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

        return this.sampler.sample(
            this.holdTime ?? (timestamp - this.startTime!) * this.speed
        ).value
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
            this.group!.schedule(true)
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
    let animations: Animation[] = []
    let needsBuild = false
    let isScheduled = false
    let lastChurn = -Infinity
    let timer: ReturnType<typeof setTimeout> | undefined

    const has = (key: string) => {
        for (const track of tracks) if (track.name === key) return true
    }

    /**
     * Build the transform at a timestamp or, without one, from the motion
     * values. Unlike buildTransform, every key is written, even at its
     * default, so each keyframe has the same list of functions and the
     * browser interpolates them one by one.
     */
    const compose = (timestamp?: number) => {
        let transform = ""
        for (const key of transformPropOrder) {
            const track = byKey.get(key)
            const value =
                timestamp === undefined
                    ? read(owner, key)
                    : track
                    ? track.sampleAt(timestamp)
                    : statics[key]

            if (value !== undefined) {
                transform +=
                    (translateAlias[key] || key) +
                    "(" +
                    getValueAsType(value, numberValueTypes[key]) +
                    ") "
            }
        }
        return transform || "none"
    }

    /**
     * Cancel the WAAPI animations, by default first writing the transform
     * from the motion values as an inline style. The renderer writes its
     * own version on its next render.
     */
    const stop = (commit = true) => {
        clearTimeout(timer)
        if (commit) element.style.transform = compose()
        animations.forEach((animation) => animation.cancel())
        animations = []
    }

    const segment = (from: number, to: number, iterations: number) => {
        const duration = to - from
        const samples = Math.max(
            1,
            Math.min(maxSamples, Math.ceil(duration / sampleDelta))
        )

        const transform: string[] = []
        for (let i = 0; i <= samples; i++) {
            transform.push(compose(from + (duration * i) / samples))
        }

        const animation = element.animate(
            { transform },
            {
                duration,
                easing: "linear",
                /**
                 * The looping part must not fill backwards over the
                 * finite part that runs before it.
                 */
                fill: iterations === Infinity ? "forwards" : "both",
                iterations,
            }
        )
        animation.startTime = from
        animations.push(animation)
    }

    /**
     * Replace the WAAPI animation(s) with ones sampled from now. Returns
     * false if the animations can't be composed.
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

        byKey.clear()
        for (const track of tracks) {
            byKey.set(track.name, track)

            const [trackEnd, trackCycle] = track.timing()

            if (trackCycle) {
                if (cycle && Math.abs(trackCycle - cycle) > 1) return
                cycle = trackCycle
            } else if (trackEnd === Infinity) {
                /**
                 * Held animations don't move, so keep their motion values
                 * up to date, as a JSAnimation would on a seek.
                 */
                track.sync()
                continue
            }

            if (track.speed < 0) return
            end = Math.max(end, trackEnd)
        }

        statics = {}
        for (const key of transformPropOrder) {
            if (!byKey.has(key)) statics[key] = read(owner, key)
        }

        stop(false)

        try {
            end > now && segment(now, end, 1)
            cycle && segment(end, end + cycle, Infinity)
        } catch {
            return
        }

        /**
         * Everything is held, so hold it with an inline style instead.
         */
        animations.length || stop()

        return true
    }

    /**
     * Finish the animations that have reached their end.
     */
    const finish = () => {
        const now = time.now()
        group.isFinishing = true
        tracks.forEach((track) => {
            const [trackEnd, trackCycle] = track.timing()

            if (
                track.state === "running" &&
                !trackCycle &&
                trackEnd <= now + 1
            ) {
                track.tick(now)

                /**
                 * Its final value is already in the WAAPI animation, so
                 * from now it's checked for outside writes like any other
                 * static transform.
                 */
                statics[track.name] = read(owner, track.name)
            }
        })
        group.isFinishing = false
        group.schedule(false)
    }

    const build = () => {
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
            if (!track.canAccelerate) return group.demote()
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

        const now = time.now()

        if (needsBuild) {
            needsBuild = false
            if (!animate(now)) return group.demote()
        }

        clearTimeout(timer)
        let next = Infinity
        tracks.forEach((track) => {
            const [trackEnd, trackCycle] = track.timing()
            trackCycle || (next = Math.min(next, trackEnd))
        })
        if (next < Infinity) timer = setTimeout(finish, Math.max(0, next - now))
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
         * An outside write or a seek. Rebuild once, but if it keeps
         * happening, move to the main thread.
         */
        churn() {
            const now = time.now()
            now - lastChurn < churnWindow
                ? group.demote()
                : group.schedule(true)
            lastChurn = now
        },

        check() {
            if (group.isJS) return

            for (const key in statics) {
                if (read(owner, key) !== statics[key] && !has(key)) {
                    return group.churn()
                }
            }
        },

        demote() {
            if (group.isJS) return

            tracks.forEach((track) => {
                track.isAccelerated() && track.sync()
                track.canAccelerate = false
            })

            group.isJS = true

            stop()

            tracks.forEach(
                (track) => track.state === "running" && track.js?.start()
            )
        },
    }

    return group
}
