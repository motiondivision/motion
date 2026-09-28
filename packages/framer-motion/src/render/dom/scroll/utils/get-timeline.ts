import { ProgressTimeline } from "motion-dom"
import { ScrollOptionsWithDefaults } from "../types"

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

/**
 * Native timelines are only attached to WAAPI animations. Offsets are
 * applied to each animation as a range, so a timeline is shared by every
 * offset.
 */
export function getTimeline({
    container,
    target,
    axis,
}: ScrollOptionsWithDefaults): ProgressTimeline {
    let containerCache = timelineCache.get(container)
    if (!containerCache) {
        containerCache = new Map()
        timelineCache.set(container, containerCache)
    }

    const targetKey = target ?? "self"
    let targetCache = containerCache.get(targetKey)
    if (!targetCache) {
        targetCache = {}
        containerCache.set(targetKey, targetCache)
    }

    return (targetCache[axis] ||= target
        ? new ViewTimeline({ subject: target, axis })
        : new ScrollTimeline({ source: container, axis } as any))
}
