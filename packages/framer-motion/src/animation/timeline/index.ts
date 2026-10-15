import {
    animateSingleValue,
    AnimationPlaybackControls,
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    GroupAnimationWithThen,
    motionValue,
    TimelineWithFallback,
} from "motion-dom"
import { removeItem } from "motion-utils"
import { animateSequence } from "../animate/sequence"
import {
    AnimationSequence,
    Segment,
    SequenceInfo,
    SequenceOptions,
    SequenceTime,
} from "../sequence/types"

export type TimelineItem = Segment | Timeline

export interface TimelineOptions extends SequenceOptions {
    /**
     * Start paused. Defaults to `true` (plays as soon as it's built).
     */
    autoplay?: boolean
    /**
     * Resolve selectors within this scope, and stop when it's torn
     * down. Pass the scope from useAnimate() in React.
     */
    scope?: AnimationScope
}

interface Marker {
    name: string
    time: number
    callback?: VoidFunction
    pause?: boolean
}

interface Entry {
    item: TimelineItem | VoidFunction
    at?: SequenceTime
    marker?: Marker
}

let markerId = 0

/**
 * Copy a segment with a new `at`, adding a transition if it has none.
 */
function withAt(segment: any[], at: SequenceTime) {
    const copy = [...segment]
    const i = typeof copy[0] === "function" ? Math.max(1, copy.length - 1) : 2
    copy[i] = { ...copy[i], at }
    return copy as Segment
}

const label = (name: string, at?: SequenceTime): Segment =>
    at === undefined ? name : { name, at }

/**
 * Rewind to the start and stop, so every value is back at the value it
 * started from and the next build reads those values as its origin.
 */
function rewind(animation: AnimationPlaybackControls) {
    animation.pause()
    animation.time = 0
    animation.stop()
}

/**
 * A sequence that can be changed after it's created. Segments, labels,
 * callbacks, pauses and other timelines can be added, moved and removed
 * at any point, including while it plays.
 *
 * Changes are batched and applied once per microtask. Each change
 * rebuilds the underlying animations from the timeline's starting
 * values, then restores the playhead, speed and play state, so changes
 * made while playing take effect without a jump.
 */
export class Timeline implements AnimationPlaybackControlsWithThen {
    finished!: Promise<void>

    private entries: Entry[] = []

    private group?: GroupAnimationWithThen

    /**
     * Tracks the playhead in seconds. Used to fire callbacks and pauses.
     */
    private clock = motionValue(0)

    private prevTime = 0

    private markers: Marker[] = []

    private labels = new Map<string, number>()

    private totalDuration = 0

    private isDirty = false

    private isPaused: boolean

    private isDone = false

    private isRebuilding = false

    private playbackSpeed = 1

    private stopAt?: number

    private parent?: Timeline

    private scrollTimeline?: TimelineWithFallback

    private resolveFinished!: VoidFunction

    constructor(
        items: TimelineItem[] = [],
        private options: TimelineOptions = {}
    ) {
        this.isPaused = options.autoplay === false
        this.newFinished()
        this.clock.on("change", (t) => this.onClock(t))
        items.forEach((item) => this.add(item))

        /**
         * Build now, like animate(), so selectors resolve while a scope
         * is attached. Later changes are batched.
         */
        this.invalidate()
        this.flush()

        /**
         * Register with the scope (for instance from useAnimate()) so it
         * stops when the scope is torn down.
         */
        const { scope } = options
        if (scope) {
            scope.animations.push(this)
            this.finished.then(() => removeItem(scope.animations, this))
        }
    }

    /**
     * Add a segment, label or timeline. `at` overrides any `at` already
     * on the segment. The item itself is the handle for `move()` and
     * `remove()`.
     */
    add(item: TimelineItem, at?: SequenceTime) {
        if (item instanceof Timeline) item.adopt(this)
        return this.push({ item, at })
    }

    /**
     * Fire a callback when the playhead crosses `at`, in either direction.
     */
    call(callback: VoidFunction, at?: SequenceTime) {
        return this.push({
            item: callback,
            at,
            marker: { name: "_m" + markerId++, time: 0, callback },
        })
    }

    /**
     * Pause when the playhead reaches `at`.
     */
    addPause(at?: SequenceTime, callback?: VoidFunction) {
        return this.push({
            item: callback || {},
            at,
            marker: { name: "_m" + markerId++, time: 0, callback, pause: true },
        } as Entry)
    }

    /**
     * Change where an item starts.
     */
    move(item: TimelineItem | VoidFunction, at: SequenceTime) {
        this.entries.forEach((entry) => {
            if (entry.item === item) entry.at = at
        })
        return this.invalidate()
    }

    /**
     * Remove a segment, label, callback or timeline.
     */
    remove(item: TimelineItem | VoidFunction) {
        if (item instanceof Timeline) item.parent = undefined
        this.entries = this.entries.filter((entry) => entry.item !== item)
        return this.invalidate()
    }

    clear() {
        this.entries = []
        return this.invalidate()
    }

    /**
     * The time of a label in seconds, or `undefined` if there's no label
     * with this name.
     */
    getLabelTime(name: string) {
        this.flush()
        return this.labels.get(name)
    }

    /**
     * Jump to a time in seconds or a label.
     */
    seek(position: SequenceTime) {
        this.time = this.resolve(position)
        return this
    }

    /**
     * Play forwards or backwards to a time or label, then pause there.
     */
    playTo(position: SequenceTime) {
        const target = this.resolve(position)
        const speed = Math.abs(this.speed)
        this.speed = target < this.time ? -speed : speed
        this.stopAt = target
        this.play()
        return this
    }

    reverse() {
        this.speed = -this.speed
        this.play()
        return this
    }

    get progress() {
        return this.duration ? this.time / this.duration : 0
    }

    set progress(progress: number) {
        this.time = progress * this.duration
    }

    get time() {
        return this.active()?.time ?? 0
    }

    set time(time: number) {
        this.flush()
        this.prevTime = time
        this.group && (this.group.time = time)
    }

    get speed() {
        return this.playbackSpeed
    }

    set speed(speed: number) {
        this.playbackSpeed = speed
        this.group && (this.group.speed = speed)
    }

    get duration() {
        this.flush()
        return this.totalDuration
    }

    get iterationDuration() {
        return this.duration
    }

    get state() {
        return this.active()?.state ?? "idle"
    }

    get startTime() {
        return this.active()?.startTime ?? null
    }

    play() {
        this.flush()
        this.isPaused = false
        if (this.isDone) {
            this.newFinished()
            this.watch()
        }
        this.group?.play()
    }

    pause() {
        this.flush()
        this.isPaused = true
        this.group?.pause()
    }

    stop = () => {
        this.flush()
        this.group?.stop()
    }

    cancel() {
        this.flush()
        this.group?.cancel()
    }

    complete() {
        this.flush()
        this.group?.complete()
    }

    attachTimeline(timeline: TimelineWithFallback) {
        this.flush()
        this.scrollTimeline = timeline
        const detach = this.group?.attachTimeline(timeline)

        return () => {
            this.scrollTimeline = undefined
            detach?.()
        }
    }

    then(onResolve: VoidFunction, onReject?: VoidFunction) {
        return this.finished.then(onResolve, onReject)
    }

    /**
     * The current animations, if any are running. Skipped animations
     * (skipAnimations, reduced motion) can leave the group empty.
     */
    private active() {
        this.flush()
        return this.group?.animations.length ? this.group : undefined
    }

    private push(entry: Entry) {
        this.entries.push(entry)
        return this.invalidate()
    }

    /**
     * Schedule a rebuild. A nested timeline passes changes up, as it's
     * built as part of its parent.
     */
    private invalidate(): this {
        if (this.parent) {
            this.parent.invalidate()
        } else if (!this.isDirty) {
            this.isDirty = true
            queueMicrotask(() => this.flush())
        }
        return this
    }

    /**
     * Apply pending changes now, so reads straight after a change
     * reflect it.
     */
    private flush() {
        this.isDirty && !this.parent && this.build()
    }

    private adopt(parent: Timeline) {
        if (this.group) {
            rewind(this.group)
            this.group = undefined
        }
        this.isDirty = false
        this.parent = parent
    }

    private build() {
        this.isDirty = false

        const prev = this.group
        let time = 0

        if (prev) {
            time = prev.animations.length ? prev.time : 0
            this.isRebuilding = true
            rewind(prev)
            this.isRebuilding = false
        }

        const { defaultTransition, onComplete, autoplay, scope, ...options } =
            this.options

        /**
         * Inherit MotionConfig settings from a useAnimate() scope.
         */
        const playback: SequenceOptions = {}
        if (scope?.reduceMotion !== undefined) {
            playback.reduceMotion = scope.reduceMotion
        }
        if (scope?.skipAnimations !== undefined) {
            playback.skipAnimations = scope.skipAnimations
        }
        Object.assign(playback, options)
        const markers = new Map<string, Marker>()
        const info: SequenceInfo = {}
        const animations = animateSequence(
            this.toSequence(markers),
            { defaultTransition, ...playback },
            scope,
            info
        )

        const labels = info.labels!
        let duration = playback.duration ?? info.duration!

        /**
         * A `duration` option stretches every animation to fit, so scale
         * label and marker times to match.
         */
        const scale = info.duration ? duration / info.duration : 1
        labels.forEach((time, name) => labels.set(name, time * scale))

        /**
         * Markers are resolved as labels. Move them out of the label map
         * and extend the duration to reach any marker past the end.
         */
        this.markers = []
        markers.forEach((marker, name) => {
            marker.time = labels.get(name)!
            labels.delete(name)
            duration = Math.max(duration, marker.time)
            this.markers.push(marker)
        })
        this.markers.sort((a, b) => a.time - b.time)
        this.labels = labels
        this.totalDuration = duration

        const group = (this.group = new GroupAnimationWithThen([
            animateSingleValue(this.clock, [0, duration], {
                ...playback,
                duration,
                ease: "linear",
            }),
            ...animations,
        ]))

        time = Math.min(time, duration)
        if (this.isDone && time < duration) this.newFinished()

        group.speed = this.playbackSpeed
        if (this.isPaused) group.pause()
        if (time) group.time = time
        /**
         * Treat a start from 0 as coming from just before it, so markers
         * at 0 fire.
         */
        this.prevTime = time || -1

        this.scrollTimeline && group.attachTimeline(this.scrollTimeline)
        this.watch()
    }

    private toSequence(markers: Map<string, Marker>): AnimationSequence {
        return this.entries.map(({ item, at, marker }) => {
            if (marker) {
                markers.set(marker.name, marker)
                return label(marker.name, at)
            }
            if (item instanceof Timeline) {
                return { sequence: item.toSequence(markers), at }
            }
            if (typeof item === "string") return label(item, at)
            if (at === undefined) return item as Segment
            return Array.isArray(item)
                ? withAt(item, at)
                : ({ ...item, at } as Segment)
        })
    }

    private resolve(position: SequenceTime) {
        return typeof position === "number"
            ? position
            : this.getLabelTime(position) ?? this.time
    }

    private onClock(time: number) {
        const prevTime = this.prevTime
        this.prevTime = time
        if (this.isRebuilding || time === prevTime) return

        const isForward = time > prevTime
        const crossed = (t: number) =>
            isForward ? t > prevTime && t <= time : t < prevTime && t >= time

        const markers = isForward ? this.markers : [...this.markers].reverse()
        for (const marker of markers) {
            if (!crossed(marker.time)) continue
            marker.callback?.()
            if (marker.pause) return this.pauseAt(marker.time)
        }

        if (this.stopAt !== undefined && crossed(this.stopAt)) {
            this.pauseAt(this.stopAt)
            this.stopAt = undefined
        }
    }

    private pauseAt(time: number) {
        this.pause()
        this.time = time
    }

    private watch() {
        const group = this.group!
        group.finished.then(() => {
            if (group !== this.group || this.isDone) return
            this.isDone = true
            this.options.onComplete?.()
            this.resolveFinished()
        })
    }

    private newFinished() {
        this.isDone = false
        this.finished = new Promise((resolve) => {
            this.resolveFinished = resolve
        })
    }
}

/**
 * Create a timeline that can be changed after it's created.
 *
 * ```js
 * const tl = timeline([[".box", { x: 100 }]])
 *
 * tl.add("spin")
 *   .add([".box", { rotate: 180 }])
 *   .call(() => console.log("halfway"), "spin")
 *
 * tl.seek("spin")
 * ```
 */
export const timeline = (items?: TimelineItem[], options?: TimelineOptions) =>
    new Timeline(items, options)
