import {
    clamp,
    Easing,
    EasingFunction,
    easingDefinitionToFunction,
    isBezierDefinition,
    isEasingArray,
} from "motion-utils"
import { frame } from "../../../frameloop/frame"
import { frameData } from "../../../frameloop/frame-data"
import { time } from "../../../frameloop/sync-time"
import {
    buildTransform,
    isDefaultTransform,
    transformFunction,
} from "../../../render/html/utils/build-transform"
import type { ResolvedValues } from "../../../render/types"
import {
    transformPropOrder,
    transformProps,
} from "../../../render/utils/keys-transform"
import type { MotionValue, Owner } from "../../../value"
import { keyframes as keyframesGenerator } from "../../generators/keyframes"
import { defaultOffset } from "../../keyframes/offsets/default"
import type { ValueTrack } from "../../MultiValueAnimation"
import { sampleDelta } from "../../utils/sample-delta"
import {
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueAnimationOptions,
} from "../../types"
import { cubicBezierAsString } from "../easing/cubic-bezier"
import { supportedWaapiEasing } from "../easing/supported"
import { canAccelerateOptions, supportsWaapi } from "../supports/waapi"
import { createStyleAnimation, setStyle } from "../../../effects/style/output"
import { acceleratedValues } from "../utils/accelerated-values"
import { generateLinearEasing } from "../utils/linear"
import { supportsLinearEasing } from "../../../utils/supports/linear-easing"
import {
    addCompositorLayer,
    isRepainting,
    markRepaint,
    TransformGroupHooks,
    transformGroups,
} from "./groups"

/**
 * Independent transforms (x, y, scale, rotate etc) all write to the one
 * `transform` style, so they can't each run as their own WAAPI animation.
 * Instead, every transform animation on an element joins a group. While
 * every animation in the group follows the same timing, the group composes
 * them into a single `transform` WAAPI animation of their keyframes, with
 * their easing. Each is still a value of its call's shared animation, which
 * skips it on each frame while the compositor runs it.
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

type TransformMember = ValueTrack

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
 * How an animation runs as WAAPI keyframes: [start, duration, iterations,
 * direction, speed, offsets, values, easings].
 */
type NativeKeyframes = [
    start: number,
    duration: number,
    iterations: number,
    direction: PlaybackDirection,
    speed: number,
    offsets: number[],
    values: AnyResolvedKeyframe[],
    easings: string[]
]

type Composed = [
    start: number,
    duration: number,
    iterations: number,
    direction: PlaybackDirection,
    speed: number,
    offsets: number[],
    props: Record<string, AnyResolvedKeyframe[]>,
    easing?: string[]
]

/**
 * Sample at the interruption sampling rate, up to a cap for long
 * animations.
 */
const maxSamples = 50

/**
 * The gap between samples: a frame, so no two are needed in one.
 */
const sampleStep = 16

/**
 * If an outside write, or a seek the WAAPI animation can't follow,
 * happens again within this window, the group is being driven every
 * frame (scrubbing, drag), which is cheaper on the main thread than
 * rebuilding the WAAPI animation every frame.
 */
const churnWindow = 100

/**
 * The last trace of each easing WAAPI can't run into linear(), with its
 * number of samples, so the elements that share an easing and duration
 * trace it once.
 */
const traced = new WeakMap<EasingFunction, [number, string]>()

const trace = (ease: EasingFunction, samples: number) => {
    let last = traced.get(ease)
    if (last?.[0] !== samples) {
        traced.set(
            ease,
            (last = [samples, generateLinearEasing(ease, samples + 1, 1)])
        )
    }
    return last[1]
}

/**
 * An easing as WAAPI runs it: a native one by name (excluding CSS
 * cubic-bezier approximations of JS math easings), a bezier by its
 * values, and anything else traced into linear().
 */
const easingAsString = (ease: Easing, samples: number) => {
    if (isBezierDefinition(ease)) return cubicBezierAsString(ease)
    const native =
        typeof ease === "string" &&
        supportedWaapiEasing[ease as keyof typeof supportedWaapiEasing]
    return native && native[0] !== "c"
        ? native
        : trace(easingDefinitionToFunction(ease), samples)
}

const byTime = (a: number, b: number) => a - b

const getOwner = (options: ValueAnimationOptions<any>) =>
    options.motionValue!.owner as TransformOwner

const getGroup = (element: Element) =>
    transformGroups.get(element) as TransformGroup | undefined

/**
 * Whether an animation has ended, so can leave its group.
 */
const hasEnded = ({ state }: TransformMember) =>
    state === "idle" || state === "finished"

/**
 * Whether a track is held (paused or speed 0) and not on a native scroll
 * timeline.
 */
const isHeld = (track: TransformMember) =>
    !track.scrollTimeline && (track.parent.holdTime !== null || !track.speed)

/**
 * When a track stops moving, in document time (Infinity if it repeats forever).
 */
const endTime = (track: TransformMember) =>
    track.startTime! +
    ((track.options.delay || 0) + track.totalDuration) / track.speed

/**
 * A motion value holds where an animation left it. A value that starts
 * where the element already is isn't written, so the owner's latest
 * values don't have it. Those hold the keys that have no motion value.
 */
const read = (owner: TransformOwner, key: string) => {
    const value = owner.getValue(key)
    return value ? value.get() : owner.latestValues?.[key]
}

/**
 * Build a transform keyframe string from values in transformPropOrder.
 * Every key is written, even at its default, so each keyframe has the
 * same list of functions and the browser interpolates them one by one.
 */
const toTransform = (values: ResolvedValues) => {
    let transform = ""
    for (const key in values) {
        transform += transformFunction(key, values[key]) + " "
    }
    return transform || "none"
}

/**
 * Whether a value of an animate() call joins its element's group: its
 * transforms, and, if the call animates one of those, its other
 * compositor values, like opacity, which then share one WAAPI animation.
 * Alone, opacity is quicker to start on an animation of its own.
 */
export const canGroupValue = (
    name: string,
    motionValue?: MotionValue,
    composes?: boolean
) =>
    Boolean(
        ((name !== "pathRotation" && transformProps.has(name)) ||
            (composes &&
                name !== "transform" &&
                acceleratedValues.has(name))) &&
            motionValue?.owner?.current instanceof HTMLElement &&
            supportsWaapi() &&
            supportsLinearEasing()
    )

export function canAccelerateTransform(options: ValueAnimationOptions<any>) {
    const owner = getOwner(options)

    return (
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
         * onUpdate, transformTemplate, inertia and custom mixers stay on
         * the main thread. Mixer is asked last, as it's user code.
         */
        canAccelerateOptions(options, true)
    )
}

/**
 * This animation as WAAPI keyframes, if WAAPI can run it: keyframes
 * with easings it has or can trace, that repeat as it does. Over a
 * scroll timeline, the keyframes span the timeline, delay included.
 * Undefined if it can't, so the group runs on the main thread.
 */
function nativeOf(
    track: TransformMember,
    isScroll?: boolean
): NativeKeyframes | undefined {
    const {
        startTime,
        calculatedDuration,
        resolvedDuration,
        totalDuration,
        options,
    } = track
    let { speed } = track
    const { keyframes, repeat, repeatType, repeatDelay, type, delay } = options
    const samples = clamp(
        2,
        maxSamples,
        Math.ceil(calculatedDuration / sampleDelta)
    )
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
            generateLinearEasing(
                (p) =>
                    (parseFloat(
                        track.sampleTime(
                            delay! + p * calculatedDuration,
                            true
                        ) as string
                    ) -
                        from) /
                    range,
                samples + 1,
                1
            ),
        ]
    }

    /**
     * A repeat delay holds the last keyframe for its share of each
     * iteration, and the animation ends with its last iteration, before
     * that one's delay. A reversed iteration starts back straight after
     * the hold, and then holds the first keyframe. WAAPI reverses a whole
     * iteration, hold included, so half the hold goes at each end of it,
     * and the animation starts half a hold in.
     */
    let values = keyframes as AnyResolvedKeyframe[]
    let start = startTime! + delay! / speed
    let duration = repeat ? resolvedDuration : totalDuration
    let iterations = repeat! + 1
    const isReversed = repeatType === "reverse"
    const prepend = () => {
        offsets.unshift(0)
        values = [values[0], ...values]
        easings.unshift("linear")
    }

    if (isScroll) {
        /**
         * Over a scroll timeline, the delay holds the first keyframe for its
         * share of the timeline.
         */
        if (delay) {
            const share = totalDuration / (delay + totalDuration)
            offsets = offsets.map((o) => 1 - share + o * share)
            prepend()
        }
        start = duration = 0
        iterations = speed = 1
    } else if (repeat && repeatDelay) {
        const share = calculatedDuration / resolvedDuration
        const lead = isReversed ? (1 - share) / 2 : 0
        offsets = [...offsets.map((o) => lead + o * share), 1]
        values = [...values, values[values.length - 1]]
        easings.push("linear")
        if (isReversed) {
            prepend()
            start -= (lead * resolvedDuration) / speed
        }
        iterations -= 1 - share - lead
    }

    return [
        start,
        duration,
        iterations,
        /**
         * Over a scroll timeline nothing repeats, as checked above.
         */
        repeat && isReversed ? "alternate" : "normal",
        speed,
        offsets,
        values,
        easings,
    ]
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
    const built = new Map<TransformMember, BuiltState>()
    /**
     * Builds the WAAPI animation shortly before it starts.
     */
    let wakeTimer: ReturnType<typeof setTimeout> | undefined
    const wake = () => schedule(true)
    /**
     * Each group waiting to build has a timer of its own. Waking several
     * at once, or from one queue of them all, costs more per frame.
     */
    const sleep = (delay: number) => {
        clearTimeout(wakeTimer)
        wakeTimer = setTimeout(wake, delay)
    }
    /**
     * How long after it was last built to build it, while waiting.
     */
    let buildAt: number | undefined
    /**
     * The WAAPI animation, when it starts relative to when the group was
     * built and how long it runs.
     */
    let native: Animation | undefined
    let scrollAnimation: Animation | undefined
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
            if (value !== undefined) setStyle(element, key, value)
        })
        /**
         * Without transform motion values, the element's own transform,
         * as from a stylesheet, is left alone.
         */
        hasTransform !== undefined &&
            setStyle(element, "transform", buildTransform(values, {}))
    }

    /**
     * Cancel the WAAPI animation and remove its handlers, as WebKit never
     * collects an animation once it has run, nor anything its handlers
     * reference (#4034). By default the transform is committed first. The
     * renderer writes its own version on its next render.
     */
    const stop = (shouldCommit = true) => {
        shouldCommit && commit()
        clearTimeout(wakeTimer)
        buildAt = undefined
        if (native) {
            native.onfinish = native.oncancel = null
            native.cancel()
            native = scrollAnimation = undefined
            addCompositorLayer(-1)
        }
    }

    /**
     * The transforms that aren't animating, and those held, as statics.
     * Those at their default are left out. Returns the animating ones.
     */
    const readStatics = (now: number) => {
        const byKey: Record<string, TransformMember> = {}
        statics = {}
        extras = []
        for (const track of tracks) {
            const { name } = track
            byKey[name] = track
            if (!transformProps.has(name)) {
                extras.push(name)
                committed.add(name)
                isHeld(track) && (statics[name] = track.sampleAt(now))
            }
        }
        keys = transformPropOrder.filter((key) => {
            const track = byKey[key]
            if (track && !isHeld(track)) return true
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
        const props: Record<string, AnyResolvedKeyframe[]> = keys.length
            ? { transform: [] }
            : {}
        for (const key of extras) props[key] = []
        return props
    }

    /**
     * A WAAPI animation that starts by setting its startTime.
     */
    const create = (
        keyframes: PropertyIndexedKeyframes | null,
        options: KeyframeAnimationOptions
    ) => {
        const animation = createStyleAnimation(element, keyframes, options)
        /**
         * Something else cancelled it, so carry on on the main thread.
         */
        animation.oncancel = () => native === animation && demote()
        native || addCompositorLayer(1)
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
        byKey: Record<string, TransformMember>,
        isScroll?: boolean
    ): Composed | null | undefined => {
        const natives: Record<string, NativeKeyframes> = {}
        let shared: NativeKeyframes | undefined
        const offsets: number[] = []
        const all = keys.concat(extras)
        /**
         * The longest of the values on each spring's curve. Springs from
         * rest follow one curve however far they move, and the one that
         * comes to rest last has the others follow its easing, and end
         * with it.
         */
        const curves: Record<string, NativeKeyframes> = {}

        for (const key of all) {
            const track = byKey[key]
            if (!track || isHeld(track)) continue

            const keyframes = nativeOf(track, isScroll)
            if (!keyframes) return
            natives[key] = keyframes

            const { curve } = track.options
            if (curve && !(curves[curve]?.[1] >= keyframes[1])) {
                curves[curve] = keyframes
            }
        }

        for (const key in natives) {
            const keyframes = natives[key]
            const longest = curves[byKey[key].options.curve!]
            if (longest) {
                keyframes[1] = longest[1]
                keyframes[7] = longest[7]
            }

            if (
                shared &&
                (Math.abs(keyframes[0] - shared[0]) > 1 ||
                    Math.abs(keyframes[1] - shared[1]) > 1 ||
                    keyframes[2] !== shared[2] ||
                    keyframes[3] !== shared[3] ||
                    keyframes[4] !== shared[4])
            ) {
                return
            }

            shared ||= keyframes
            for (const offset of keyframes[5]) {
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
                const keyframes = natives[key]
                let value = statics[key]!

                if (keyframes) {
                    const kfOffsets = keyframes[5]
                    const kfValues = keyframes[6]
                    /**
                     * Its keyframe at this offset or, if it has none, the
                     * value it holds across it.
                     */
                    let index = kfOffsets.indexOf(offsets[i])
                    const isOwn = index >= 0
                    if (!isOwn) {
                        index = kfOffsets.findIndex((o) => o > offsets[i]) - 1
                    }
                    value = kfValues[index]
                    const isMoving = value !== kfValues[index + 1]
                    if (!isOwn && isMoving) return

                    /**
                     * The span from this keyframe to the next has the easing
                     * of every animation that moves over it, which must agree.
                     */
                    if (
                        isOwn &&
                        isMoving &&
                        i < offsets.length - 1 &&
                        kfOffsets[index + 1] === offsets[i + 1]
                    ) {
                        const ease = keyframes[7][index]
                        if (spanEasing && spanEasing !== ease) return
                        spanEasing = ease
                    }
                }

                props[key] ? props[key].push(value) : (values[key] = value)
            }

            props.transform?.push(toTransform(values))
            i < offsets.length - 1 && easing.push(spanEasing || "linear")
        }

        return [
            shared[0],
            shared[1],
            shared[2],
            shared[3],
            shared[4],
            offsets,
            props,
            easing,
        ]
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
        byKey: Record<string, TransformMember>,
        now: number
    ): Composed | undefined => {
        let end = Infinity
        const times: number[] = []
        const moving: TransformMember[] = []

        for (const track of tracks) {
            if (track.speed < 0) return
            if (isHeld(track)) continue
            moving.push(track)
            end = Math.min(end, endTime(track))
        }
        if (!(end < Infinity)) return

        const duration = end - now
        const step = Math.max(sampleStep, duration / maxSamples)
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
            const track = byKey[key]
            return track && !isHeld(track) ? track.sampleAt(t) : statics[key]!
        }
        const props = listsFor()
        for (const t of times) {
            const values: ResolvedValues = {}
            for (const key of keys) values[key] = at(key, t)
            props.transform?.push(toTransform(values))
            for (const key of extras) props[key].push(at(key, t))
        }

        return [
            now,
            duration,
            1,
            "normal",
            1,
            times.map((t) => (t - now) / duration),
            props,
        ]
    }

    /**
     * Replace the WAAPI animation with one built from now. Returns
     * undefined if the animations can't be composed.
     */
    const animate = (now: number) => {
        built.clear()
        for (const track of tracks) {
            built.set(track, [track.at(now), track.speed, isHeld(track)])
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

        let [
            start,
            duration,
            iterations,
            direction,
            speed,
            offsets,
            props,
            easing,
        ] = composed
        let endDelay = 0

        /**
         * Played once, it's built from when it starts to move until it
         * stops, as a sequence segment, holding its last keyframe until
         * the animations end.
         */
        if (iterations === 1 && speed > 0) {
            const lists = Object.values(props)
            const row = (i: number) => lists.map((list) => list[i]) + ""
            let first = 0
            let last = offsets.length - 1
            while (first < last && row(first + 1) === row(first)) first++
            while (last > first && row(last - 1) === row(last)) last--

            if (first < last) {
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
                easing &&= easing.slice(first, last)

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
        }

        /**
         * Only what moves is animated, and what doesn't is held with an
         * inline style. A transform that doesn't move, even at its
         * default, would make the element a containing block. If nothing
         * moves, the empty animation still finishes the animations.
         */
        let keyframes: PropertyIndexedKeyframes | null = null
        let hasHeld = false
        for (const key in props) {
            const values = props[key]
            values.some((v) => v !== values[0])
                ? ((keyframes ||= {})[key] = values as string[])
                : (hasHeld = true)
        }
        hasHeld && commit()
        if (keyframes && offsets.length > 2) {
            keyframes.offset = offsets
            easing?.some((e) => e !== "linear") && (keyframes.easing = easing)
        }

        nativeStart = start - now
        nativeLength = duration * iterations + endDelay
        const animation = create(keyframes, {
            duration,
            iterations,
            direction,
            endDelay,
            easing: offsets.length > 2 ? "linear" : easing?.[0] || "linear",
            fill: "both",
        })
        speed !== 1 && (animation.playbackRate = speed)
        animation.startTime = time.now() + nativeStart

        /**
         * Rebuild anything that carries on past its end.
         */
        if (iterations < Infinity) animation.onfinish = wake

        return true
    }

    /**
     * Build one WAAPI animation on a native scroll timeline every
     * animation follows. Each animation runs from its start to its end
     * over the timeline, as one followed from JS does.
     */
    const buildScroll = (timeline: TimelineWithFallback) => {
        built.clear()
        const composed = compose(readStatics(time.now()), true)
        stop(false)
        if (!composed) return composed === null ? commit() : demote(true)

        const props = composed[6] as PropertyIndexedKeyframes
        props.offset = composed[5]
        props.easing = composed[7]
        const animation = create(props, { duration: 1000, fill: "both" })
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
            const trackHeld = isHeld(track)

            /**
             * With nothing on the compositor, a held animation is set
             * where it's held, so it can be seeked as often as needed.
             */
            if (wasHeld) {
                if (trackHeld && (trackTime === builtTime || !native)) continue
                return false
            }

            const trackElapsed = (trackTime - builtTime) / builtSpeed
            const trackRate = trackHeld ? 0 : track.speed / builtSpeed

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
            clearTimeout(wakeTimer)
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

        if (rate) {
            if (
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
            } else {
                native.playbackRate !== rate && (native.playbackRate = rate)
                native.startTime = now - local / rate
            }
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
                if (track.state !== "running" || track.scrollTimeline) return

                const { speed } = track

                /**
                 * Played backwards, it finishes at its start.
                 */
                if (
                    !(speed > 0
                        ? endTime(track) <= now + 1
                        : speed < 0 && track.at(now) <= 1)
                ) {
                    return
                }

                track.complete()

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

        /**
         * One of too many elements repainting every frame, it stays on the
         * main thread until it stops.
         */
        if (isRepainting(element)) return demote(true)

        let timeline: TimelineWithFallback | undefined | false = false
        for (const track of tracks) {
            const { scrollTimeline } = track
            if (
                !track.canAccelerate ||
                (timeline !== false && scrollTimeline !== timeline)
            ) {
                return demote(true)
            }
            timeline = scrollTimeline
        }

        /**
         * Everything that kept the group on the main thread has finished,
         * so move the remaining animations back to the compositor.
         */
        if (group.isJS) {
            group.isJS = false
            needsBuild = true
        }

        const shouldBuild = needsBuild
        const churned = hasChurned
        needsBuild = hasChurned = false

        if (timeline) return buildScroll(timeline)

        if (shouldBuild || !retime(now, churned)) {
            if (churned) {
                if (now - lastChurn < churnWindow) return demote()
                lastChurn = now
            }
            /**
             * Timing that isn't shared runs on the main thread until it
             * is again, as when a value joining a loop ends.
             */
            if (!animate(now)) return demote(true)
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
        tracks.forEach((track) => isHeld(track) && track.sync())
    }

    const schedule = (build_: boolean, isChurn?: boolean) => {
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
    }

    const demote = (canReturn?: boolean): true | void => {
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
        built.clear()

        stop()

        /**
         * Paused animations tick too, as a JSAnimation does, so one
         * paused before its first frame still renders it.
         */
        tracks.forEach((track) => hasEnded(track) || track.parent.js?.start())

        /**
         * Values on a native scroll timeline follow it from JS instead.
         */
        tracks.forEach((track) => track.scrollTimeline && track.observe())

        return true
    }

    const group: TransformGroup = {
        tracks,
        isJS: false,
        isFinishing: false,
        schedule,
        demote,

        scrollTime(track) {
            const progress =
                !group.isJS &&
                scrollAnimation?.effect?.getComputedTiming().progress

            return typeof progress === "number"
                ? progress * track.iterationDuration * 1000
                : undefined
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
            end() || schedule(true)
        },

        /**
         * An outside write. Rebuild once, but if it keeps happening, move
         * to the main thread.
         */
        check() {
            if (group.isJS) return

            for (const key in statics) {
                if (read(owner, key) !== statics[key] && !has(key)) {
                    return schedule(true, true)
                }
            }
        },

        repaint: (value) => markRepaint(element, value),
    }

    transformGroups.set(element, group)

    return group
}
