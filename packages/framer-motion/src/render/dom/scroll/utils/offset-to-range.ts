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

const stringToProgress: Record<string, number> = {
    start: 0,
    end: 1,
}

function parseStringOffset(
    s: string
): ProgressIntersection | undefined {
    const parts = s.trim().split(/\s+/)
    if (parts.length !== 2) return undefined
    const a = stringToProgress[parts[0]]
    const b = stringToProgress[parts[1]]
    if (a === undefined || b === undefined) return undefined
    return [a, b]
}

function normaliseOffset(offset: ScrollOffset): ProgressIntersection[] | undefined {
    if (offset.length !== 2) return undefined
    const result: ProgressIntersection[] = []
    for (const item of offset) {
        if (Array.isArray(item)) {
            result.push(item as ProgressIntersection)
        } else if (typeof item === "string") {
            const parsed = parseStringOffset(item)
            if (!parsed) return undefined
            result.push(parsed)
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
