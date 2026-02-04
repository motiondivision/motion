import type { AnimationPlaybackControlsWithThen } from "motion-dom"
import { createAnimationsFromSequence } from "../create"
import type { AnimationSequence, NestedSequenceOptions, Segment } from "../types"

/**
 * WeakMap that stores the original AnimationSequence used to create
 * an animation controls object. This allows animation controls to be
 * used as segments in a parent sequence.
 */
export const sequenceCache = new WeakMap<
    AnimationPlaybackControlsWithThen,
    AnimationSequence
>()

/**
 * Duck-type check for animation controls objects.
 */
function isAnimationControls(
    value: unknown
): value is AnimationPlaybackControlsWithThen {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof (value as any).play === "function" &&
        typeof (value as any).pause === "function"
    )
}

/**
 * Heuristic to detect a bare nested sequence (an array of segments).
 *
 * A bare sequence looks like: [[el, {x:1}], [el, {y:1}]]
 * We need to distinguish this from a multi-target segment: [[el1, el2], {x:1}]
 *
 * Detection: segment[0] is an array AND any of:
 * - segment has only 1 element (single sub-segment wrapper)
 * - segment has more than 3 elements (normal segments have at most 3)
 * - segment[1] is also an array (second element is sub-segment, not keyframes)
 */
function isBareSequence(segment: any[]): segment is AnimationSequence {
    if (!Array.isArray(segment[0])) return false
    return (
        segment.length === 1 ||
        segment.length > 3 ||
        Array.isArray(segment[1])
    )
}

/**
 * Detect a wrapped sequence: [sequence, options?]
 * where sequence is an array containing array sub-segments.
 *
 * Catches: [[[el, {x:1}], ...], { repeat: 2 }]
 * Rejects: [[el1, el2], {x:1}] (multi-target, elements aren't arrays)
 */
function isWrappedSequence(
    segment: any[]
): segment is [AnimationSequence, NestedSequenceOptions?] {
    return (
        Array.isArray(segment[0]) &&
        segment[0].some(Array.isArray) &&
        (segment.length === 1 || (segment.length === 2 && !Array.isArray(segment[1])))
    )
}

/**
 * Calculate the natural duration of a sequence by resolving it.
 */
function getSequenceDuration(sequence: AnimationSequence): number {
    const definitions = createAnimationsFromSequence(sequence)
    let maxDuration = 0
    definitions.forEach(({ transition }) => {
        for (const key in transition) {
            const duration = transition[key].duration
            if (typeof duration === "number" && duration > maxDuration) {
                maxDuration = duration
            }
        }
    })
    return maxDuration
}

/**
 * Scale timing values in segments by a given factor.
 */
function scaleSegments(
    segments: Segment[],
    scale: number
): Segment[] {
    return segments.map((segment) => {
        if (typeof segment === "string" || !Array.isArray(segment)) {
            return segment
        }

        // Clone the segment
        const cloned = [...segment] as any[]

        // Find the transition object (last element if it's a plain object)
        const lastIndex = cloned.length - 1
        const last = cloned[lastIndex]

        if (
            last !== null &&
            typeof last === "object" &&
            !Array.isArray(last) &&
            lastIndex > 0
        ) {
            const transition = { ...last }
            if (typeof transition.duration === "number") {
                transition.duration *= scale
            }
            if (typeof transition.delay === "number") {
                transition.delay *= scale
            }
            if (typeof transition.repeatDelay === "number") {
                transition.repeatDelay *= scale
            }
            // Scale relative at values
            if (typeof transition.at === "string") {
                const at = transition.at as string
                if (at.startsWith("+") || at.startsWith("-")) {
                    transition.at = (
                        at.startsWith("+") ? "+" : ""
                    ) + String(parseFloat(at) * scale)
                } else if (at.startsWith("<+") || at.startsWith("<-")) {
                    transition.at =
                        "<" +
                        (at[1] === "+" ? "+" : "") +
                        String(parseFloat(at.slice(1)) * scale)
                }
            }
            cloned[lastIndex] = transition
        }

        return cloned as Segment
    })
}

/**
 * Expand a sub-sequence with options (at, repeat, duration) into flat segments.
 */
function expandSubSequence(
    subSequence: AnimationSequence,
    options?: NestedSequenceOptions
): Segment[] {
    let segments: Segment[] = flattenSequence(subSequence)

    if (!options) return segments

    const { at, repeat, duration } = options

    // Duration scaling
    if (typeof duration === "number") {
        const naturalDuration = getSequenceDuration(subSequence)
        if (naturalDuration > 0) {
            segments = scaleSegments(segments, duration / naturalDuration)
        }
    }

    // Apply `at` to the first segment
    if (at !== undefined && segments.length > 0) {
        const first = segments[0]

        if (typeof first === "string") {
            // Labels can't have `at`, insert a label-with-time
            segments[0] = { name: first, at }
        } else if (Array.isArray(first)) {
            const cloned = [...first] as any[]
            const lastIndex = cloned.length - 1
            const last = cloned[lastIndex]

            if (
                last !== null &&
                typeof last === "object" &&
                !Array.isArray(last) &&
                lastIndex > 0
            ) {
                cloned[lastIndex] = { ...last, at }
            } else {
                cloned.push({ at })
            }
            segments[0] = cloned as Segment
        }
    }

    // Repeat: duplicate segments
    if (typeof repeat === "number" && repeat > 0) {
        const base = [...segments]
        for (let i = 0; i < repeat; i++) {
            segments.push(...base)
        }
    }

    return segments
}

/**
 * Recursively flatten an AnimationSequence, resolving nested sequences
 * and animation controls references into a flat array of segments.
 *
 * Fast path: if no nesting is detected, returns the original array
 * with zero allocation.
 */
export function flattenSequence(sequence: AnimationSequence): AnimationSequence {
    // Fast path: scan for any nesting
    let hasNesting = false
    for (let i = 0; i < sequence.length; i++) {
        const segment = sequence[i]

        // Check for bare animation controls
        if (isAnimationControls(segment)) {
            hasNesting = true
            break
        }

        if (Array.isArray(segment)) {
            // Check for wrapped animation controls [controls, options?]
            if (isAnimationControls(segment[0])) {
                hasNesting = true
                break
            }
            // Check for bare nested sequence
            if (isBareSequence(segment)) {
                hasNesting = true
                break
            }
            // Check for wrapped nested sequence
            if (isWrappedSequence(segment)) {
                hasNesting = true
                break
            }
        }
    }

    if (!hasNesting) return sequence

    const result: Segment[] = []

    for (let i = 0; i < sequence.length; i++) {
        const segment = sequence[i]

        // Bare animation controls
        if (isAnimationControls(segment)) {
            const cached = sequenceCache.get(
                segment as AnimationPlaybackControlsWithThen
            )
            if (cached) {
                result.push(...expandSubSequence(cached))
            }
            continue
        }

        if (!Array.isArray(segment)) {
            // String label or SequenceLabelWithTime - pass through
            result.push(segment)
            continue
        }

        // Wrapped animation controls [controls, options?]
        if (isAnimationControls(segment[0])) {
            const cached = sequenceCache.get(
                segment[0] as AnimationPlaybackControlsWithThen
            )
            if (cached) {
                result.push(
                    ...expandSubSequence(
                        cached,
                        segment[1] as NestedSequenceOptions
                    )
                )
            }
            continue
        }

        // Bare nested sequence
        if (isBareSequence(segment)) {
            result.push(...expandSubSequence(segment as AnimationSequence))
            continue
        }

        // Wrapped nested sequence [sequence, options?]
        if (isWrappedSequence(segment)) {
            result.push(
                ...expandSubSequence(
                    segment[0] as AnimationSequence,
                    segment[1] as NestedSequenceOptions
                )
            )
            continue
        }

        // Normal segment - pass through
        result.push(segment as Segment)
    }

    return result
}
