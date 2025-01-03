import {
    AnimationPlaybackControls,
    ProgressTimeline,
    supportsScrollTimeline,
} from "motion-dom"
import { noop } from "motion-utils"
import { observeTimeline } from "./observe"
import { scrollInfo } from "./track"
import { OnScroll, OnScrollWithInfo, ScrollOptions } from "./types"

declare global {
    interface Window {
        ScrollTimeline: ScrollTimeline
    }
}

declare class ScrollTimeline implements ProgressTimeline {
    constructor(options: ScrollOptions)

    currentTime: null | { value: number }

    cancel?: VoidFunction
}

function scrollTimelineFallback({
    source,
    container,
    axis = "y",
}: ScrollOptions) {
    // Support legacy source argument. Deprecate later.
    if (source) container = source

    // ScrollTimeline records progress as a percentage CSSUnitValue
    const currentTime = { value: 0 }

    const cancel = scrollInfo(
        (info) => {
            currentTime.value = info[axis].progress * 100
        },
        { container, axis }
    )

    return { currentTime, cancel }
}

const timelineCache = new Map<
    Element,
    { x?: ScrollTimeline; y?: ScrollTimeline }
>()

function getTimeline({
    source,
    container = document.documentElement,
    axis = "y",
}: ScrollOptions = {}): ScrollTimeline {
    // Support legacy source argument. Deprecate later.
    if (source) container = source

    if (!timelineCache.has(container)) {
        timelineCache.set(container, {})
    }

    const elementCache = timelineCache.get(container)!

    if (!elementCache[axis]) {
        elementCache[axis] = supportsScrollTimeline()
            ? new ScrollTimeline({ source: container, axis })
            : scrollTimelineFallback({ source: container, axis })
    }

    return elementCache[axis]!
}

/**
 * If the onScroll function has two arguments, it's expecting
 * more specific information about the scroll from scrollInfo.
 */
function isOnScrollWithInfo(onScroll: OnScroll): onScroll is OnScrollWithInfo {
    return onScroll.length === 2
}

/**
 * Currently, we only support element tracking with `scrollInfo`, though in
 * the future we can also offer ViewTimeline support.
 */
function needsElementTracking(options?: ScrollOptions) {
    return options && (options.target || options.offset)
}

function scrollFunction(onScroll: OnScroll, options: ScrollOptions) {
    if (isOnScrollWithInfo(onScroll) || needsElementTracking(options)) {
        return scrollInfo((info) => {
            onScroll(info[options.axis!].progress, info)
        }, options)
    } else {
        return observeTimeline(onScroll, getTimeline(options))
    }
}

function scrollAnimation(
    animation: AnimationPlaybackControls,
    options: ScrollOptions
) {
    animation.flatten()

    if (needsElementTracking(options)) {
        animation.pause()
        return scrollInfo((info) => {
            animation.time = animation.duration * info[options.axis!].progress
        }, options)
    } else {
        const timeline = getTimeline(options)

        if (animation.attachTimeline) {
            return animation.attachTimeline(timeline, (valueAnimation) => {
                valueAnimation.pause()

                return observeTimeline((progress) => {
                    valueAnimation.time = valueAnimation.duration * progress
                }, timeline)
            })
        } else {
            return noop as VoidFunction
        }
    }
}

export function scroll(
    onScroll: OnScroll | AnimationPlaybackControls,
    { axis = "y", ...options }: ScrollOptions = {}
): VoidFunction {
    const optionsWithDefaults = { axis, ...options }

    return typeof onScroll === "function"
        ? scrollFunction(onScroll, optionsWithDefaults)
        : scrollAnimation(onScroll, optionsWithDefaults)
}
