import { frameData, ProgressTimeline } from "motion-dom"
import { clamp } from "motion-utils"
import { offsetsToProgress } from "../offsets"
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
 * derived from the length of the cover range, which starts where the target
 * meets the end of the scrollport and ends where it leaves the start. It's
 * read once per frame and shared by every value on the range.
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
                currentTime = null

                if (cover) {
                    const coverLength =
                        timeline.endOffset.value - timeline.startOffset.value
                    const view = timeline.source[length]
                    const toScroll = (t: number, c: number) =>
                        (1 - c) * view + t * (coverLength - view)

                    currentTime = {
                        value:
                            clamp(
                                0,
                                1,
                                offsetsToProgress(
                                    [toScroll(t0, c0), toScroll(t1, c1)],
                                    // Layout units, as a zero-length range steps at its point
                                    Math.round(
                                        cover.value * coverLength * 0.64
                                    ) / 64
                                )
                            ) * 100,
                    }
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
