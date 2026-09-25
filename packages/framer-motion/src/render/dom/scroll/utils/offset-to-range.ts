import { resolveOffset } from "../offsets/offset"
import { ScrollOffset as presets } from "../offsets/presets"
import { ScrollOffset } from "../types"

export interface ViewTimelineRange {
    /**
     * Named range offsets of the offset's two points.
     */
    points: string[]

    /**
     * The two points as [target progress, container progress].
     */
    intersections: number[][]

    /**
     * The offset runs forwards when a × target length + b × container length
     * is >= 0. Otherwise its range runs from the second point to the first,
     * with progress reversed.
     */
    a: number
    b: number

    /**
     * Whether this is the ViewTimeline's default range, run forwards.
     */
    cover: boolean
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
    offset: ScrollOffset = presets.All
): ViewTimelineRange | undefined {
    if (offset.length !== 2) return

    const [start, end] = offset.map(toIntersection)
    const points = [toRange(start), toRange(end)]
    const a = end[0] - start[0]
    const b = start[1] - end[1]

    if (points[0] && points[1] && (a || b)) {
        return {
            points: points as string[],
            intersections: [start, end],
            a,
            b,
            cover: !start[0] && a === 1 && b === 1,
        }
    }
}
