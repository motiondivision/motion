import {
    activeScope,
    animateSingleValue,
    AnimationPlaybackControls,
    AnimationPlaybackControlsWithThen,
    AnimationScope,
    GroupAnimationWithThen,
    MotionValue,
    motionValue,
    TimelineWithFallback,
} from "motion-dom"
import { removeItem } from "motion-utils"
import { animateSequence } from "../animate/sequence"
import { calcLabelTime } from "../sequence/utils/calc-time"
import {
    AnimationSequence,
    Segment,
    SequenceInfo,
    SequenceOptions,
    SequenceTime,
} from "../sequence/types"

export type TimelineItem = Segment | Timeline

/**
 * Called with the playback direction: 1 forwards, -1 backwards.
 */
export type TimelineCallback = (direction: 1 | -1) => void

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
    /**
     * Called every frame while the playhead moves, with its time in
     * seconds within the current repeat.
     */
    onUpdate?: (time: number) => void
    /**
     * Called each time the timeline starts a repeat.
     */
    onRepeat?: () => void
    /**
     * Called instead of `onComplete` when the timeline finishes
     * playing backwards, at its start.
     */
    onReverseComplete?: () => void
}

interface Marker {
    name: string
    time: number
    callback?: TimelineCallback
    pause?: boolean
}

interface Entry {
    item: TimelineItem | TimelineCallback
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
    finished!: Promise<any>

    private entries: Entry[] = []

    private group?: GroupAnimationWithThen

    /**
     * Tracks the playhead in seconds. Used to fire callbacks, pauses and
     * playTo(). Only created when one of those needs it.
     */
    private clock?: MotionValue<number>

    private clockAnimation?: AnimationPlaybackControls

    /**
     * The repeat the playhead is in, to detect when it starts another.
     */
    private repeatIndex = 0

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

    private detachScroll?: VoidFunction

    private resolveFinished!: VoidFunction

    private motionScope = activeScope.current

    /**
     * True while this plays the animations it was created with, before
     * any change compiles it as a sequence.
     */
    private isWrapped = false

    /**
     * `animations` are already running animations of `items`, as
     * animate() makes them. The timeline plays these until it's first
     * changed, so it costs nothing over the animations themselves until
     * then.
     */
    constructor(
        items: TimelineItem[] = [],
        private options: TimelineOptions = {},
        animations?: AnimationPlaybackControlsWithThen[]
    ) {
        this.isPaused = options.autoplay === false
        this.newFinished()
        items.forEach((item) => this.add(item))

        if (animations) {
            this.isDirty = false
            this.isWrapped = true
            this.group = new GroupAnimationWithThen(animations)
            this.watch()
        } else {
            /**
             * Build now, like animate(), so selectors resolve while a
             * scope is attached. Later changes are batched.
             */
            this.invalidate()
            this.flush()
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
     * It receives the direction: 1 forwards, -1 backwards.
     */
    call(callback: TimelineCallback, at?: SequenceTime) {
        return this.push({
            item: callback,
            at,
            marker: { name: "_m" + markerId++, time: 0, callback },
        })
    }

    /**
     * Pause when the playhead reaches `at`.
     */
    addPause(at?: SequenceTime, callback?: TimelineCallback) {
        return this.push({
            item: callback || {},
            at,
            marker: { name: "_m" + markerId++, time: 0, callback, pause: true },
        } as Entry)
    }

    /**
     * Change where an item starts.
     */
    move(item: TimelineItem | TimelineCallback, at: SequenceTime) {
        this.entries.forEach((entry) => {
            if (entry.item === item) entry.at = at
        })
        return this.invalidate()
    }

    /**
     * Remove a segment, label, callback or timeline.
     */
    remove(item: TimelineItem | TimelineCallback) {
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
        this.clock || this.invalidate()
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
        this.repeatIndex = this.currentRepeat()
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
        return this.isWrapped ? this.group!.duration : this.totalDuration
    }

    get iterationDuration() {
        this.flush()
        return this.isWrapped
            ? this.group!.iterationDuration
            : this.totalDuration
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
        this.group?.play()

        /**
         * Watch after playing, so it waits for the restarted animations
         * rather than the ones that already finished.
         */
        if (this.isDone) {
            this.newFinished()
            this.watch()
        }
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
        this.detachScroll = this.group?.attachTimeline(timeline)

        return () => {
            this.scrollTimeline = undefined
            this.detachScroll?.()
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
        this.isWrapped = false

        const prev = this.group
        let time = 0

        if (prev) {
            this.isRebuilding = true
            if (this.scrollTimeline) {
                /**
                 * Scroll-linked animations can't be seeked in seconds.
                 * Cancelling also returns them to their starting values,
                 * and the new build is attached to scroll instead.
                 */
                this.detachScroll?.()
                prev.cancel()
            } else {
                time = prev.animations.length ? prev.time : 0
                rewind(prev)
            }
            this.isRebuilding = false
        }

        const {
            defaultTransition,
            onComplete,
            onUpdate,
            onRepeat,
            onReverseComplete,
            autoplay,
            scope,
            ...options
        } = this.options

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

        /**
         * Callbacks, pauses and playTo() watch a linear clock. Without
         * them, the timeline is only its animations.
         */
        this.clock = this.clockAnimation = undefined
        if (
            this.markers.length ||
            this.stopAt !== undefined ||
            onUpdate ||
            onRepeat
        ) {
            const clock = (this.clock = motionValue(0))
            clock.on("change", (t) => clock === this.clock && this.onClock(t))
            animations.unshift(
                (this.clockAnimation = animateSingleValue(
                    clock,
                    [0, duration],
                    {
                        ...playback,
                        duration,
                        ease: "linear",
                    }
                ))
            )
        }

        const group = (this.group = new GroupAnimationWithThen(animations))

        time = Math.min(time, duration)
        if (this.isDone && time < duration) this.newFinished()

        if (this.scrollTimeline) {
            this.detachScroll = group.attachTimeline(this.scrollTimeline)
        } else {
            group.speed = this.playbackSpeed
            if (this.isPaused) group.pause()
            if (time) group.time = time
        }
        this.repeatIndex = this.currentRepeat()
        /**
         * Treat a start from 0 as coming from just before it, so markers
         * at 0 fire.
         */
        this.prevTime = time || -1

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
        this.flush()
        return typeof position === "number"
            ? position
            : calcLabelTime(position, this.labels) ?? this.time
    }

    /**
     * The repeat the clock is in, from its time across all repeats.
     */
    private currentRepeat() {
        const { repeat = 0, repeatDelay = 0, delay = 0 } = this.options
        const cycle = this.totalDuration + repeatDelay
        const time = (this.clockAnimation?.time ?? 0) - delay
        return cycle && time > 0
            ? Math.min(repeat, Math.floor(time / cycle))
            : 0
    }

    private onClock(time: number) {
        let prevTime = this.prevTime
        this.prevTime = time
        if (this.isRebuilding) return

        const { onUpdate, onRepeat, repeatType = "loop" } = this.options
        onUpdate?.(time)

        const repeatIndex = this.currentRepeat()
        if (repeatIndex !== this.repeatIndex) {
            this.repeatIndex = repeatIndex
            onRepeat?.()

            /**
             * A loop jumps the playhead back to the start, or to the
             * end when playing backwards. Finish crossing the repeat
             * that ended, then cross the new one from its edge.
             */
            if (repeatType === "loop") {
                const isForward = this.speed > 0
                if (this.cross(prevTime, isForward ? this.totalDuration : 0)) {
                    return
                }
                prevTime = isForward ? -1 : Infinity
            }
        }

        this.cross(prevTime, time)
    }

    /**
     * Fire markers between two playhead times. Returns `true` if it
     * paused.
     */
    private cross(from: number, to: number) {
        if (from === to) return

        const isForward = to > from
        const crossed = (t: number) =>
            isForward ? t > from && t <= to : t < from && t >= to

        const markers = isForward ? this.markers : [...this.markers].reverse()
        for (const marker of markers) {
            if (!crossed(marker.time)) continue
            marker.callback?.(isForward ? 1 : -1)
            if (marker.pause) return this.pauseAt(marker.time)
        }

        if (this.stopAt !== undefined && crossed(this.stopAt)) {
            this.pauseAt(this.stopAt)
            this.stopAt = undefined
            return true
        }
    }

    private pauseAt(time: number) {
        this.pause()
        this.time = time
        return true
    }

    private watch() {
        const group = this.group!
        group.finished.then(() => {
            if (group !== this.group || this.isDone) return
            this.isDone = true
            const { onComplete, onReverseComplete } = this.options
            /**
             * Without onReverseComplete, onComplete fires in either
             * direction, as it does for a single animation.
             */
            const callback = (this.speed < 0 && onReverseComplete) || onComplete
            /**
             * Resolve this run's promise, even if the callback plays the
             * timeline again and so makes a new one.
             */
            const resolve = this.resolveFinished
            callback?.()
            resolve()
        })
    }

    private newFinished() {
        this.isDone = false
        this.finished = new Promise<void>((resolve) => {
            this.resolveFinished = resolve
        })

        /**
         * Register with the scopeMotion() scope this was created in and
         * the useAnimate() scope until finished, so they stop it. Each
         * replay registers again.
         */
        const { scope } = this.options
        const remove = this.motionScope?.add(this.stop)
        scope?.animations.push(this)
        this.finished.then(() => {
            remove?.()
            scope && removeItem(scope.animations, this)
        })
    }
}
