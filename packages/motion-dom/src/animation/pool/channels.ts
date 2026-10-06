import { setStyle } from "../../render/dom/style-set"
import {
    applyTransformStyles,
    buildIndependentTransform,
    canUseIndependentTransforms,
    independentTransformProperty,
    transformChannelHooks,
} from "../../render/html/utils/independent-transforms"
import { ResolvedValues } from "../../render/types"
import { transformPropOrder } from "../../render/utils/keys-transform"
import type { MotionValue, Owner } from "../../value"
import { numberValueTypes } from "../../value/types/maps/number"
import { getValueAsType } from "../../value/types/utils/get-as-type"
import { keyframes as keyframesGenerator } from "../generators/keyframes"
import { getOptimisedAppearId } from "../optimized-appear/get-appear-id"
import type { WithAppearProps } from "../optimized-appear/types"
import { mapEasingToNativeEasing } from "../waapi/easing/map-easing"
import { acceleratedValues } from "../waapi/utils/accelerated-values"
import { generateLinearEasing } from "../waapi/utils/linear"
import { replaceStringEasing } from "../waapi/utils/unsupported-easing"
import { supportsLinearEasing } from "../../utils/supports/linear-easing"
import {
    supportsBrowserAnimation,
    supportsWaapi,
} from "../waapi/supports/waapi"
import type { Pool, PoolTrack } from "./Pool"
import { createTrack, getTrackEnd } from "./track"

/**
 * A channel is how one CSS property reaches the screen on one element
 * while it's hardware-accelerated: one WAAPI animation, fed by the tracks
 * of one pool. Independent transforms use the individual `translate`,
 * `scale` and `rotate` properties, so each is its own channel and can be
 * animated, interrupted and controlled without touching the others.
 * Values that share a property (x and y) share a channel, and so must
 * share a pool and timing.
 *
 * A channel winds down when its tracks finish or are all released: it
 * writes the final style inline and cancels the animation in the same
 * task, so nothing is dropped between the two. If something else needs
 * to write the property on the main thread (a JS track, a sibling value
 * changing, layout measurement) the channel is demoted: its tracks carry
 * on from the same time on the pool's JS tick.
 */
export interface Channel {
    property: string
    pool?: Pool
    tracks: PoolTrack[]
    /**
     * JS tracks (from any pool) currently writing this property. While
     * there are any, the property can't be accelerated.
     */
    blockers: number
    animation?: Animation
    /**
     * For transform channels, the other values of the property that are
     * baked into the keyframes. If one changes, the channel is demoted.
     */
    statics?: ResolvedValues
}

export interface ChannelOwner extends Owner, Partial<WithAppearProps> {
    latestValues?: ResolvedValues
    getValue(key: string): MotionValue | undefined
    projection?: {
        options: { layout?: boolean | string; layoutId?: string }
        isProjecting(): boolean
    }
}

interface ElementChannels {
    element: HTMLElement
    owner: ChannelOwner
    channels: Map<string, Channel>
    /**
     * The number of accelerated transform channels. While there are any,
     * the element renders its transforms through the individual
     * properties.
     */
    transforms: number
}

const elementChannels = new WeakMap<Element, ElementChannels>()

const isTransformChannel = (property: string) =>
    property === "translate" || property === "scale" || property === "rotate"

/**
 * The CSS property a value writes to when accelerated.
 */
export const getChannelProperty = (key: string) =>
    independentTransformProperty[key] || key

/**
 * Whether a value could ever be accelerated, so JS tracks for it need
 * to block the property's channel.
 */
export const hasChannel = (key: string) =>
    Boolean(independentTransformProperty[key]) ||
    acceleratedValues.has(key) ||
    key === "backgroundColor" ||
    key === "color"

/**
 * The owner's transform values, as a VisualElement's latestValues or read
 * from the values bound to an effect.
 */
export function readValues(owner: ChannelOwner): ResolvedValues {
    if (owner.latestValues) return owner.latestValues

    const values: ResolvedValues = {}
    for (const key of transformPropOrder) {
        const value = owner.getValue(key)?.get()
        if (value !== undefined) values[key] = value
    }
    return values
}

function getElementChannels(owner: ChannelOwner) {
    const element = owner.current as HTMLElement
    let ec = elementChannels.get(element)
    if (!ec) {
        ec = { element, owner, channels: new Map(), transforms: 0 }
        elementChannels.set(element, ec)
    }
    return ec
}

function getChannel(ec: ElementChannels, property: string) {
    let channel = ec.channels.get(property)
    if (!channel) {
        channel = { property, tracks: [], blockers: 0 }
        ec.channels.set(property, channel)
    }
    return channel
}

/**
 * Whether an independent transform on this element can be accelerated.
 * Layout animations and optimised appear animations write the transform
 * shorthand themselves, and axis scales with rotation don't commute.
 */
function canAccelerateTransform(owner: ChannelOwner, key: string) {
    const { projection } = owner
    return (
        !(
            projection &&
            (projection.options.layout ||
                projection.options.layoutId ||
                projection.isProjecting())
        ) &&
        !(
            owner.props &&
            window.MotionHasOptimisedAnimation?.(
                getOptimisedAppearId(owner as WithAppearProps),
                "transform"
            )
        ) &&
        canUseIndependentTransforms(readValues(owner), key)
    )
}

/**
 * Whether a track can run on a channel rather than the pool's JS tick.
 */
export function canAccelerate(track: PoolTrack, owner?: ChannelOwner) {
    const { options } = track
    const { name, isHandoff, onUpdate, repeatDelay, repeatType, damping } =
        options

    if (
        !owner ||
        isHandoff ||
        !(owner.current instanceof HTMLElement) ||
        /**
         * onUpdate needs a value every frame, which the compositor
         * doesn't provide.
         */
        onUpdate
    ) {
        return false
    }

    /**
     * A spring between equal keyframes moves only through its velocity,
     * which identical WAAPI keyframes can't show.
     */
    const { keyframes } = options
    if (
        options.type !== keyframesGenerator &&
        keyframes[0] === keyframes[keyframes.length - 1]
    ) {
        return false
    }

    if (!independentTransformProperty[name!]) {
        return supportsBrowserAnimation(options)
    }

    const props = owner.getProps()

    return (
        supportsWaapi() &&
        !props.onUpdate &&
        !props.transformTemplate &&
        !repeatDelay &&
        repeatType !== "mirror" &&
        damping !== 0 &&
        options.type !== "inertia" &&
        canAccelerateTransform(owner, name!)
    )
}

/**
 * Write the element's transform styles inline, in the representation its
 * channels need: the individual properties while any transform is
 * accelerated, the shorthand otherwise.
 */
function commitTransforms(ec: ElementChannels) {
    const style: ResolvedValues = {}
    applyTransformStyles(readValues(ec.owner), style, ec.transforms > 0)
    for (const key in style) {
        setStyle(ec.element, key, style[key])
    }
}

/**
 * The native easing for a track: WAAPI's own easings where the track has
 * one, otherwise its generator sampled into a linear() easing, which also
 * carries an interrupting spring's velocity.
 */
function getEasing(track: PoolTrack, duration: number) {
    const { options, generator, mixKeyframes } = track

    if (options.type === keyframesGenerator) {
        replaceStringEasing(options)
        return mapEasingToNativeEasing(options.ease, duration)
    }

    const [from, to] = mixKeyframes
        ? [0, 100]
        : (options.keyframes as number[])
    const range = to - from

    return range
        ? generateLinearEasing(
              (progress) =>
                  ((generator.next(duration * progress).value as number) -
                      from) /
                  range,
              duration
          )
        : "linear"
}

/**
 * The WAAPI keyframes and options for a channel's tracks. Undefined if the
 * tracks can't share one animation.
 */
function getAnimation(channel: Channel, ec: ElementChannels) {
    const { tracks, property } = channel
    const [first] = tracks
    const {
        delay = 0,
        repeat = 0,
        repeatType,
        times,
        keyframes: firstKeyframes,
    } = first.options
    const duration = first.calculatedDuration
    const easing = getEasing(first, duration)
    const easingKey = String(easing)

    for (let i = 1; i < tracks.length; i++) {
        const track = tracks[i]
        const { options } = track
        if (
            (options.delay || 0) !== delay ||
            track.calculatedDuration !== duration ||
            (options.repeat || 0) !== repeat ||
            options.repeatType !== repeatType ||
            String(options.times) !== String(times) ||
            options.keyframes.length !== firstKeyframes.length ||
            String(getEasing(track, duration)) !== easingKey
        ) {
            return
        }
    }

    let frames: (string | number)[]
    if (isTransformChannel(property)) {
        const statics: ResolvedValues = (channel.statics = {})
        const values = readValues(ec.owner)
        const composed: ResolvedValues = {}

        for (const key in independentTransformProperty) {
            if (
                independentTransformProperty[key] === property &&
                !tracks.some((track) => track.key === key) &&
                values[key] !== undefined
            ) {
                statics[key] = composed[key] = values[key]
            }
        }

        frames = firstKeyframes.map((_, i) => {
            for (const track of tracks) {
                composed[track.key] = track.options.keyframes[i]
            }
            return buildIndependentTransform(composed, property as any, true)
        })
    } else {
        frames = firstKeyframes
    }

    const keyframes: PropertyIndexedKeyframes = {
        [property]: frames as string[],
    }
    if (times) keyframes.offset = times
    if (Array.isArray(easing)) keyframes.easing = easing

    const options: KeyframeAnimationOptions = {
        delay,
        duration,
        easing: Array.isArray(easing) ? "linear" : easing,
        fill: "both",
        iterations: repeat + 1,
        direction: repeatType === "reverse" ? "alternate" : "normal",
    }

    return { keyframes, options }
}

/**
 * Hand a pool's tracks for one property to the element's channel. Returns
 * false if they must run on the main thread instead: the property is
 * already being written there, or the tracks can't share an animation.
 */
export function claimChannel(
    pool: Pool,
    owner: ChannelOwner,
    tracks: PoolTrack[]
): boolean {
    const ec = getElementChannels(owner)
    const property = getChannelProperty(tracks[0].key)
    const channel = getChannel(ec, property)

    /**
     * Another pool's animation is on this property. Both would need the
     * compositor to combine two animations on one property, which it
     * won't, so both carry on on the main thread.
     */
    if (channel.tracks.length) demoteChannel(channel)
    if (channel.blockers) return false

    channel.pool = pool
    channel.tracks = tracks

    /**
     * Without linear() easing, springs can't be expressed to WAAPI, so
     * they run as an eased tween instead, as they always have.
     */
    if (!supportsLinearEasing()) {
        for (const track of tracks) {
            const { options } = track
            if (options.type !== keyframesGenerator) {
                options.type = "keyframes"
                options.duration ??= 300
                options.ease ??= "easeOut"
                Object.assign(track, createTrack(options))
            }
        }
    }

    const animation = getAnimation(channel, ec)
    if (!animation) {
        channel.tracks = []
        return false
    }

    try {
        channel.animation = ec.element.animate(
            animation.keyframes,
            animation.options
        )
    } catch {
        channel.tracks = []
        return false
    }

    channel.animation.onfinish = () => finishChannel(channel, ec)
    syncChannel(channel)

    if (isTransformChannel(property) && ++ec.transforms === 1) {
        commitTransforms(ec)
    }

    for (const track of tracks) track.channel = channel

    return true
}

/**
 * Align the channel's animation with its pool's clock.
 */
export function syncChannel({ animation, pool }: Channel) {
    if (!animation || !pool) return

    animation.playbackRate = pool.speed

    if (pool.holdTime !== null) {
        animation.pause()
        animation.currentTime = pool.holdTime
    } else {
        animation.playState === "paused" && animation.play()
        animation.startTime = pool.startTime
    }
}

/**
 * A main-thread track has started writing a property. While any does, the
 * property's channel can't be accelerated. Returns the channel so the
 * track can unblock it, even once the element is gone.
 */
export function blockChannel(owner: ChannelOwner, key: string) {
    const element = owner.current
    if (!element || typeof element !== "object") return

    const channel = getChannel(
        getElementChannels(owner),
        getChannelProperty(key)
    )
    channel.blockers++
    if (channel.tracks.length) demoteChannel(channel)

    return channel
}

function cancelChannel(channel: Channel, ec: ElementChannels) {
    const wasTransform = isTransformChannel(channel.property)
    for (const track of channel.tracks) track.channel = undefined
    channel.tracks = []
    channel.pool = undefined

    if (wasTransform) {
        ec.transforms--
        commitTransforms(ec)
    }

    channel.animation?.cancel()
    channel.animation = undefined
}

/**
 * Move the channel's tracks to their pool's JS tick, from the same time,
 * and write their current values inline before cancelling the animation.
 */
export function demoteChannel(channel: Channel) {
    const { pool, tracks } = channel
    if (!pool || !tracks.length) return

    const ec = getElementChannels(pool.owner!)
    channel.blockers += tracks.length
    pool.demote(tracks)
    cancelChannel(channel, ec)
}

/**
 * A track has been released from its channel, e.g. by an interrupting
 * animation. The rest continue, with its current value baked in.
 */
export function releaseFromChannel(track: PoolTrack) {
    const { channel } = track
    if (!channel) return

    track.channel = undefined
    const { pool, tracks } = channel
    const ec = getElementChannels(pool!.owner!)
    tracks.splice(tracks.indexOf(track), 1)

    if (!tracks.length) {
        if (!isTransformChannel(channel.property)) {
            setStyle(
                ec.element,
                channel.property,
                getValueAsType(
                    track.value.get(),
                    numberValueTypes[channel.property]
                )
            )
        }
        cancelChannel(channel, ec)
    } else {
        const animation = getAnimation(channel, ec)
        animation
            ? (channel.animation!.effect as KeyframeEffect).setKeyframes(
                  animation.keyframes
              )
            : demoteChannel(channel)
    }
}

function finishChannel(channel: Channel, ec: ElementChannels) {
    const { pool, tracks, property } = channel
    if (!pool || !tracks.length) return

    /**
     * Commit the final value before cancelling so the fill is never
     * removed before the next render applies it.
     */
    pool.completeTracks(tracks)

    if (!isTransformChannel(property)) {
        setStyle(
            ec.element,
            property,
            getTrackEnd(tracks[0], pool.speed) as string
        )
    }

    cancelChannel(channel, ec)
}

/**
 * Called by a pool when it's completed: its channels jump to their end.
 */
export const completeChannel = (channel: Channel) =>
    channel.pool && finishChannel(channel, getElementChannels(channel.pool.owner!))

/**
 * Called by a pool when it's cancelled: the channel's tracks have already
 * been written to their motion values, so write the property inline and
 * cancel the animation in the same task.
 */
export function windDownChannel(channel: Channel) {
    const { pool, tracks, property } = channel
    if (!pool || !tracks.length) return

    const ec = getElementChannels(pool.owner!)

    if (!isTransformChannel(property)) {
        setStyle(
            ec.element,
            property,
            getValueAsType(tracks[0].value.get(), numberValueTypes[property])
        )
    }

    cancelChannel(channel, ec)
}

/**
 * Called before an element with channels renders. If a value baked into
 * an accelerated transform has changed on the main thread, or a transform
 * arrived that has no individual property, the animation would mask the
 * render, so it's demoted first. Returns whether the element renders
 * through the individual transform properties.
 */
function renderChannels(element: Element, values: ResolvedValues) {
    const ec = elementChannels.get(element)
    if (!ec || !ec.transforms) return false

    const canAccelerate = canUseIndependentTransforms(values)

    ec.channels.forEach((channel) => {
        const { statics, tracks } = channel
        if (!tracks.length || !statics) return

        if (!canAccelerate) return demoteChannel(channel)

        for (const key in statics) {
            if (values[key] !== statics[key]) return demoteChannel(channel)
        }
    })

    return ec.transforms > 0
}

transformChannelHooks.render = renderChannels
transformChannelHooks.has = (element) =>
    Boolean(elementChannels.get(element)?.transforms)

/**
 * Move every accelerated transform on an element to the main thread, e.g.
 * before layout is measured.
 */
export function demoteTransformChannels(element: Element) {
    const ec = elementChannels.get(element)
    if (!ec || !ec.transforms) return

    ec.channels.forEach(
        (channel) => channel.statics && demoteChannel(channel)
    )
}

transformChannelHooks.demote = demoteTransformChannels
