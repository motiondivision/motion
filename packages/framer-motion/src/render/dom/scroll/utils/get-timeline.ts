import { ProgressTimeline } from "motion-dom"
import { scrollInfo } from "../track"
import { ScrollOptionsWithDefaults } from "../types"
import { canUseNativeTimeline } from "./can-use-native-timeline"
import { offsetToViewTimelineRange } from "./offset-to-range"

declare class ScrollTimeline implements ProgressTimeline {
    constructor(options: ScrollOptions)

    currentTime: null | { value: number }

    cancel?: VoidFunction
}

declare class ViewTimeline implements ProgressTimeline {
    constructor(options: { subject: Element; axis?: string })

    currentTime: null | { value: number }

    cancel?: VoidFunction
}

const timelineCache = new Map<
    Element,
    Map<Element | "self", Record<string, ProgressTimeline>>
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

    let containerCache = timelineCache.get(container)
    if (!containerCache) {
        containerCache = new Map()
        timelineCache.set(container, containerCache)
    }

    const targetKey = options.target ?? "self"
    let targetCache = containerCache.get(targetKey)
    if (!targetCache) {
        targetCache = {}
        containerCache.set(targetKey, targetCache)
    }

    const axisKey = axis + (options.offset ?? []).join(",")

    if (!targetCache[axisKey]) {
        if (options.target && canUseNativeTimeline(options.target)) {
            const range = offsetToViewTimelineRange(options.offset)
            if (range) {
                targetCache[axisKey] = new ViewTimeline({
                    subject: options.target,
                    axis,
                })
            } else {
                targetCache[axisKey] = scrollTimelineFallback({
                    container,
                    ...options,
                })
            }
        } else if (canUseNativeTimeline()) {
            targetCache[axisKey] = new ScrollTimeline({
                source: container,
                axis,
            } as any)
        } else {
            targetCache[axisKey] = scrollTimelineFallback({
                container,
                ...options,
            })
        }
    }

    return targetCache[axisKey]!
}
