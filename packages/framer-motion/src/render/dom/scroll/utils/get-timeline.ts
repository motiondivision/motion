import { ProgressTimeline, supportsScrollTimeline } from "motion-dom"
import { scrollInfo } from "../track"
import { ScrollOptionsWithDefaults } from "../types"

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

const timelineCache = new Map<
    Element,
    { x?: ProgressTimeline; y?: ProgressTimeline }
>()

function scrollTimelineFallback(options: ScrollOptionsWithDefaults) {
    const currentTime = { value: 0 }

    const cancel = scrollInfo((info) => {
        currentTime.value = info[options.axis!].progress * 100
    }, options)

    return { currentTime, cancel }
}

export function getTimeline({
    source,
    container,
    ...options
}: ScrollOptionsWithDefaults): ProgressTimeline {
    const { axis } = options

    // Support legacy source argument. Deprecate later.
    if (source) container = source

    if (!timelineCache.has(container)) {
        timelineCache.set(container, {})
    }

    const elementCache = timelineCache.get(container)!

    if (!elementCache[axis]) {
        elementCache[axis] = supportsScrollTimeline()
            ? new ScrollTimeline({ source: container, axis } as any)
            : scrollTimelineFallback({ container, ...options })
    }

    return elementCache[axis]!
}
