import { ScrollOffset as ScrollOffsetPresets } from "../offsets/presets"
import { ProgressIntersection, ScrollOffset } from "../types"

interface ViewTimelineRange {
    rangeStart: string
    rangeEnd: string
}

/**
 * Maps from ProgressIntersection pairs used by Motion's preset offsets to
 * ViewTimeline named ranges. Returns undefined for unrecognised patterns,
 * which signals the caller to fall back to JS-based scroll tracking.
 */
const presets: [ProgressIntersection[], string][] = [
    [ScrollOffsetPresets.Enter, "entry"],
    [ScrollOffsetPresets.Exit, "exit"],
    [ScrollOffsetPresets.Any, "cover"],
    [ScrollOffsetPresets.All, "contain"],
]

function normaliseOffset(offset: ScrollOffset): ProgressIntersection[] | undefined {
    if (offset.length !== 2) return undefined
    const result: ProgressIntersection[] = []
    for (const item of offset) {
        if (Array.isArray(item)) {
            result.push(item as ProgressIntersection)
        } else {
            return undefined
        }
    }
    return result
}

function matchesPreset(
    offset: ScrollOffset,
    preset: ProgressIntersection[]
): boolean {
    const normalised = normaliseOffset(offset)
    if (!normalised) return false

    for (let i = 0; i < 2; i++) {
        const o = normalised[i]
        const p = preset[i]
        if (o[0] !== p[0] || o[1] !== p[1]) return false
    }
    return true
}

export function offsetToViewTimelineRange(
    offset?: ScrollOffset
): ViewTimelineRange | undefined {
    if (!offset) {
        return { rangeStart: "contain 0%", rangeEnd: "contain 100%" }
    }

    for (const [preset, name] of presets) {
        if (matchesPreset(offset, preset)) {
            return { rangeStart: `${name} 0%`, rangeEnd: `${name} 100%` }
        }
    }

    return undefined
}
