import { frameData, ProgressTimeline } from "motion-dom"
import { clamp, progress } from "motion-utils"
import { scrollInfo } from "../track"
import { ScrollOptionsWithDefaults } from "../types"
import { canUseNativeTimeline } from "./can-use-native-timeline"
import { offsetToViewTimelineRange, ViewTimelineRange } from "./offset-to-range"

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

/**
 * A ViewTimeline's currentTime is its cover progress. A range's progress is
 * derived from the cover range's scroll offsets, which start where the
 * target meets the end of the scrollport and end where it leaves the start.
 * It's read once per frame and shared by every value on the range.
 */
function rangeTimeline(
    timeline: any,
    [[t0, c0], [t1, c1]]: number[][],
    length: "clientHeight" | "clientWidth"
): ProgressTimeline {
    let timestamp: number
    let currentTime: { value: number } | null

    return {
        get currentTime() {
            if (timestamp !== frameData.timestamp) {
                timestamp = frameData.timestamp
                const cover = timeline.currentTime
                const start = timeline.startOffset?.value
                const coverLength = timeline.endOffset?.value - start
                const view = timeline.source?.[length]
                const toScroll = (t: number, c: number) =>
                    start + (1 - c) * view + t * (coverLength - view)
                const from = toScroll(t0, c0)
                const to = toScroll(t1, c1)
                // Snapped to layout units, as a zero-length range steps at its point
                const scroll =
                    Math.round(
                        (start + (cover?.value / 100) * coverLength) * 64
                    ) / 64

                currentTime = cover && {
                    value:
                        from === to && scroll < from
                            ? 0
                            : clamp(0, 1, progress(from, to, scroll)) * 100,
                }
            }

            return currentTime
        },
    }
}

export function getTimeline(
    { container, ...options }: ScrollOptionsWithDefaults,
    range?: ViewTimelineRange
): ProgressTimeline {
    const { axis, target } = options

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

    const axisKey = axis + (options.offset ?? []).join(",")

    if (!targetCache[axisKey]) {
        targetCache[axisKey] =
            !canUseNativeTimeline(target) ||
            (target && !offsetToViewTimelineRange(options.offset))
                ? scrollTimelineFallback({ container, ...options })
                : target
                ? new ViewTimeline({ subject: target, axis })
                : new ScrollTimeline({ source: container, axis } as any)
    }

    return range
        ? (targetCache[axisKey + "range"] ||= rangeTimeline(
              targetCache[axisKey],
              range.intersections,
              axis === "y" ? "clientHeight" : "clientWidth"
          ))
        : targetCache[axisKey]!
}
