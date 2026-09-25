import { resolveOffset } from "../offsets/offset"
import { ScrollOffset } from "../types"

interface ViewTimelineRange {
    rangeStart?: string
    rangeEnd?: string
}

/**
 * Resolved offsets are linear in the target and container lengths, so
 * probing them gives [target progress, container progress, pixels].
 * vw/vh can resolve to 0px, so they're rejected up front.
 */
const toIntersection = (o: ScrollOffset[number]) => {
    if (/v/u.test(o as string)) return []
    const px = resolveOffset(o, 0, 0, 0)
    return [resolveOffset(o, 0, 1, 0) - px, px - resolveOffset(o, 1, 0, 0), px]
}

const toRange = ([t, c, px]: number[]) =>
    !px &&
    (c === 0 || c === 1) &&
    `${c ? "entry" : "exit"}-crossing ${t * 100}%`

/**
 * Maps an offset to an equivalent ViewTimeline range. Returns undefined when
 * there isn't one, which signals the caller to fall back to JS-based scroll
 * tracking.
 */
export function offsetToViewTimelineRange(
    offset?: ScrollOffset
): ViewTimelineRange | undefined {
    if (offset?.length !== 2) return

    const [start, end] = offset.map(toIntersection)
    const [t0, c0] = start
    const [t1, c1] = end
    const rangeStart = toRange(start)
    const rangeEnd = toRange(end)

    /**
     * A range can't run backwards, so the offset must progress forwards
     * for every target and container size.
     */
    if (
        !rangeStart ||
        !rangeEnd ||
        t1 < t0 ||
        c1 > c0 ||
        (t1 === t0 && c1 === c0)
    )
        return

    /**
     * Full cover is a ViewTimeline's default range, and the only one its
     * currentTime reports.
     */
    return !t0 && t1 === 1 && c0 > c1 ? {} : { rangeStart, rangeEnd }
}
