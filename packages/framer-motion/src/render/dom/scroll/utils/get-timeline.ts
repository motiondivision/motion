import { ProgressTimeline } from "motion-dom"
import { scrollInfo } from "../track"
import { ScrollOptionsWithDefaults } from "../types"
import { canUseNativeTimeline } from "./can-use-native-timeline"

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
    Map<Element | "self", { x?: ProgressTimeline; y?: ProgressTimeline }>
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

    if (source) container = source

    const containerCache = timelineCache.get(container) ?? new Map()
    timelineCache.set(container, containerCache)

    const targetKey = options.target ?? "self"
    const targetCache = containerCache.get(targetKey) ?? {}

    const axisKey = axis + (options.offset ?? []).join(",")

    if (!targetCache[axisKey]) {
        targetCache[axisKey] =
            canUseNativeTimeline(options.target)
                ? new ScrollTimeline({ source: container, axis } as any)
                : scrollTimelineFallback({ container, ...options })
    }

    return targetCache[axisKey]!
}
