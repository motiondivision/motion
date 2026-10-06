import { time } from "../frameloop/sync-time"
import { setStyle } from "../render/dom/style-set"
import {
    buildIndependentTransform,
    buildIndependentTransforms,
    canUseIndependentTransforms,
    independentTransformHooks,
    independentTransformProperty,
    IndependentTransformProperty,
} from "../render/html/utils/independent-transforms"
import type { ResolvedValues } from "../render/types"
import { JSAnimation } from "./JSAnimation"
import { getFinalKeyframe } from "./keyframes/get-final"
import { NativeAnimation } from "./NativeAnimation"
import {
    NativeAnimationOptionsExtended,
    sampleNativeAnimation,
} from "./NativeAnimationExtended"
import {
    AnimationPlaybackControls,
    AnyResolvedKeyframe,
    TimelineWithFallback,
    ValueTransition,
} from "./types"
import { notifyAnimationStart } from "./utils/notify-inspector"
import { replaceTransitionType } from "./utils/replace-transition-type"
import { mapEasingToNativeEasing } from "./waapi/easing/map-easing"
import { applyGeneratorOptions } from "./waapi/utils/apply-generator"
import { replaceStringEasing } from "./waapi/utils/unsupported-easing"

/**
 * One hardware-accelerated animation per element per individual transform
 * property (translate, scale, rotate). Values that share a property and
 * start together with the same timing join the same WAAPI animation, so
 * `animate={{ x: 100, y: 50 }}` is one composited `translate` animation while
 * `scale` and `rotate` run and can be interrupted independently.
 */
interface TransformGroup {
    property: IndependentTransformProperty
    animation: Animation
    axes: Map<string, NativeTransformAnimation<any>>
    /**
     * Keyframes per animating value. Every entry has the same length.
     */
    keyframes: Map<string, AnyResolvedKeyframe[]>
    /**
     * Values of the property's other transforms baked into the keyframes.
     * If one of these changes, the group moves to the main thread.
     */
    statics: ResolvedValues
    timing: string
    createdAt: number
}

type TransformGroups = Partial<
    Record<IndependentTransformProperty, TransformGroup>
>

const axesByProperty: Record<IndependentTransformProperty, string[]> = {
    translate: ["x", "y", "z"],
    scale: ["scale", "scaleX", "scaleY"],
    rotate: ["rotate", "rotateZ"],
}

const groups = new WeakMap<Element, TransformGroups>()

/**
 * An unbound transform is equal to its default value.
 */
const isSameValue = (
    axis: string,
    a: AnyResolvedKeyframe | undefined,
    b: AnyResolvedKeyframe | undefined
) => {
    const def = axis.startsWith("scale") ? 1 : 0
    return (a ?? def) === (b ?? def)
}

interface TransformOwner {
    latestValues: ResolvedValues
    renderState: { independentTransforms?: boolean }
}

function getOwner(options: NativeAnimationOptionsExtended<any>) {
    return options.motionValue!.owner as unknown as TransformOwner
}

function composeKeyframes(group: TransformGroup, latestValues: ResolvedValues) {
    const { property, keyframes, statics } = group
    const axes = axesByProperty[property]
    const values: ResolvedValues = {}
    const composed: string[] = []
    const numKeyframes = keyframes.values().next().value!.length

    for (let i = 0; i < numKeyframes; i++) {
        for (const axis of axes) {
            const axisKeyframes = keyframes.get(axis)
            values[axis] = axisKeyframes
                ? axisKeyframes[i]
                : (statics[axis] = latestValues[axis])
        }
        composed.push(buildIndependentTransform(values, property, true))
    }

    return composed
}

function getKeyframes(
    group: TransformGroup,
    latestValues: ResolvedValues,
    { times }: ValueTransition,
    easing: string | string[] | undefined
) {
    const keyframes: PropertyIndexedKeyframes = {
        [group.property]: composeKeyframes(group, latestValues),
    }
    if (times) keyframes.offset = times
    if (Array.isArray(easing)) keyframes.easing = easing
    return keyframes
}

function deleteGroup(element: Element, group: TransformGroup) {
    const elementGroups = groups.get(element)
    if (elementGroups?.[group.property] === group) {
        delete elementGroups[group.property]
    }
}

/**
 * Move every value in the group onto a JS animation that continues from the
 * WAAPI animation's current time, then release the WAAPI animation.
 */
function demoteGroup(element: Element, group: TransformGroup) {
    const { animation, axes, property } = group
    deleteGroup(element, group)

    let owner: TransformOwner | undefined

    axes.forEach((axis) => {
        owner = getOwner(axis.options)
        axis.demote(animation)
    })

    if (owner) {
        setStyle(
            element as HTMLElement,
            property,
            buildIndependentTransform(owner.latestValues, property)
        )
    }

    animation.cancel()
}

/**
 * Called before each render of an element with accelerated transforms. If a
 * value sharing a property with an accelerated animation has changed on the
 * main thread, or a transform arrived that has no individual property, the
 * accelerated animation would mask the render, so move it to the main thread.
 *
 * Returns whether any accelerated animation remains. If none does, the
 * element renders through the transform shorthand again, so an idle element
 * looks the same as one that was never accelerated.
 */
export function syncTransformGroups(
    element: Element,
    latestValues: ResolvedValues
) {
    const elementGroups = groups.get(element)
    if (!elementGroups) return false

    const canAccelerate = canUseIndependentTransforms(latestValues)
    let active = false
    let property: IndependentTransformProperty

    for (property in elementGroups) {
        const group = elementGroups[property]!
        if (!canAccelerate) {
            demoteGroup(element, group)
            continue
        }

        let changed = false
        for (const axis in group.statics) {
            if (!isSameValue(axis, latestValues[axis], group.statics[axis])) {
                changed = true
                break
            }
        }

        changed ? demoteGroup(element, group) : (active = true)
    }

    return active
}

independentTransformHooks.sync = syncTransformGroups

export class NativeTransformAnimation<
    T extends AnyResolvedKeyframe
> extends NativeAnimation<T> {
    options: NativeAnimationOptionsExtended<T>

    private property: IndependentTransformProperty

    private group: TransformGroup

    private stopped = false

    constructor(
        options: NativeAnimationOptionsExtended<T>,
        /**
         * Replaces this animation with a JS animation when its property
         * can no longer be accelerated.
         */
        private swap: (animation: AnimationPlaybackControls) => void
    ) {
        replaceStringEasing(options)
        replaceTransitionType(options)

        super()

        this.options = options

        const { element, name, keyframes, startTime, autoplay } = options
        const owner = getOwner(options)
        const property = (this.property = independentTransformProperty[name!])

        const transition = applyGeneratorOptions(options)
        const { delay = 0, duration = 300, repeat = 0, repeatType } = transition
        const easing = mapEasingToNativeEasing(transition.ease, duration)
        const timing = `${delay}|${duration}|${easing}|${repeat}|${repeatType}|${transition.times}|${startTime}|${keyframes.length}`

        let elementGroups = groups.get(element!)
        if (!elementGroups) groups.set(element!, (elementGroups = {}))

        let group = elementGroups[property]
        const now = time.now()

        if (group) {
            if (group.timing !== timing || group.createdAt !== now) {
                /**
                 * This value shares a property with an animation that has
                 * different timing. Both must run on the main thread.
                 */
                demoteGroup(element!, group)
                throw new Error("Transform property busy")
            }
        } else {
            group = elementGroups[property] = {
                property,
                animation: undefined as unknown as Animation,
                axes: new Map(),
                keyframes: new Map(),
                statics: {},
                timing,
                createdAt: now,
            }
        }

        this.group = group
        group.axes.set(name!, this)
        group.keyframes.set(name!, keyframes)
        group.statics = {}

        if (!owner.renderState.independentTransforms) {
            /**
             * Move the element's transforms onto the individual properties
             * now, in the same frame the accelerated animation starts.
             */
            owner.renderState.independentTransforms = true
            buildIndependentTransforms(
                owner.latestValues,
                (element as HTMLElement).style as any
            )
        }

        const keyframeOptions = getKeyframes(
            group,
            owner.latestValues,
            transition,
            easing
        )

        if (group.animation) {
            ;(group.animation.effect as KeyframeEffect).setKeyframes(
                keyframeOptions
            )
            this.animation = group.animation
        } else {
            this.animation = group.animation = element!.animate(
                keyframeOptions,
                {
                    delay,
                    duration,
                    easing: Array.isArray(easing) ? "linear" : easing,
                    fill: "both",
                    iterations: repeat + 1,
                    direction:
                        repeatType === "reverse" ? "alternate" : "normal",
                }
            )

            if (autoplay === false) this.animation.pause()

            /**
             * Only set startTime when the animation should autoplay.
             * Setting startTime on a paused WAAPI animation unpauses it.
             */
            if (startTime !== undefined && autoplay !== false) {
                this.startTime = startTime
            }

            this.animation.onfinish = () => this.finishGroup()
        }

        notifyAnimationStart(this, options, transition)
    }

    private finishGroup() {
        const { group } = this
        const { animation, axes, property } = group
        const { element } = this.options
        const owner = getOwner(this.options)

        deleteGroup(element!, group)

        axes.forEach((axis) => {
            axis.finishedTime = axis.time
            axis.updateMotionValue(
                getFinalKeyframe(
                    axis.options.keyframes,
                    axis.options,
                    axis.options.finalKeyframe,
                    animation.playbackRate
                )
            )
        })

        /**
         * Commit the final values before cancelling so the fill is never
         * removed before the next render applies them.
         */
        setStyle(
            element!,
            property,
            buildIndependentTransform(owner.latestValues, property)
        )

        animation.cancel()

        axes.forEach((axis) => {
            axis.options.onComplete?.()
            axis.notifyFinished()
        })
    }

    /**
     * Continue this value on the main thread from the accelerated
     * animation's current time, rate and play state.
     */
    demote({ currentTime, startTime, playbackRate, playState }: Animation) {
        const { options } = this
        const { motionValue, onComplete } = options
        const paused = playState === "paused"
        const now = Number(currentTime) || 0

        /**
         * Set the current value now so the inline style written when the
         * accelerated animation is cancelled is correct.
         */
        const { previous, current, delta } = sampleNativeAnimation(
            options,
            now,
            paused ? 0 : playbackRate
        )
        motionValue!.setWithVelocity(previous, current, delta)

        /**
         * Share the accelerated animation's start time rather than
         * measuring from now: the accelerated animation's time is that of
         * the last frame, so measuring from now would lose up to a frame.
         */
        const animation = new JSAnimation({
            ...options,
            autoplay: false,
            startTime: startTime === null ? undefined : Number(startTime),
            onComplete: () => {
                onComplete?.()
                this.notifyFinished()
            },
        })
        animation.speed = playbackRate

        if (paused) {
            animation.time = now / 1000
        } else {
            animation.play()
        }

        this.swap(animation)

        return animation
    }

    updateMotionValue(value?: T) {
        const { motionValue, element } = this.options

        if (!motionValue) return

        if (value !== undefined) {
            motionValue.set(value)
            return
        }

        const { animation } = this.group
        const { previous, current, delta } = sampleNativeAnimation(
            this.options,
            Number(animation.currentTime) || 0,
            animation.playState === "paused" ? 0 : animation.playbackRate
        )

        motionValue.setWithVelocity(previous, current, delta)

        /**
         * Write the estimated value to inline style so it persists
         * after cancel(), covering the async gap before the next
         * animation starts.
         */
        setStyle(
            element!,
            this.property,
            buildIndependentTransform(
                getOwner(this.options).latestValues,
                this.property
            )
        )
    }

    private leaveGroup() {
        const { group } = this
        const { element } = this.options

        group.axes.delete(this.options.name!)
        group.keyframes.delete(this.options.name!)

        if (group.axes.size) {
            /**
             * Other values still animate on this property. They need their
             * own animation now so this value's next animation isn't masked.
             */
            demoteGroup(element!, group)
        } else {
            deleteGroup(element!, group)
            group.animation.cancel()
        }
    }

    /**
     * A timeline-driven animation on a shared property can't be joined by
     * other values, so continue it on the main thread as before.
     */
    attachTimeline(options: TimelineWithFallback): VoidFunction {
        const { animation } = this.group
        this.leaveGroup()
        return this.demote(animation).attachTimeline(options)
    }

    stop() {
        if (this.stopped) return
        this.stopped = true

        const { state } = this
        if (state === "idle" || state === "finished") return

        this.updateMotionValue()
        this.leaveGroup()
    }

    cancel() {
        if (this.state === "idle") return
        this.leaveGroup()
    }
}
