import { clamp, progress } from "motion-utils"
import { Axis, axisKeys } from "../info"
import { ScrollInfo, ScrollInfoOptions } from "../types"
import { resolveOffset } from "./offset"
import { ScrollOffset } from "./presets"

/**
 * Resolved offsets map to evenly spaced progress values, so progress is
 * derived from the segment index rather than building an interpolator.
 */
function offsetsToProgress(offsets: number[], v: number) {
    const n = offsets.length - 1
    if (n < 1) return 0

    const reverse = offsets[0] > offsets[n]
    const at = (i: number) => offsets[reverse ? n - i : i]

    /**
     * Matches interpolate(), which checks for a zero-length first range
     * before reversing descending offsets.
     */
    if (offsets[0] === offsets[1] && v < at(0)) return reverse ? 1 : 0

    let i = 0
    while (i < n - 1 && v >= at(i + 1)) i++

    const p = (i + progress(at(i), at(i + 1), v)) / n
    return reverse ? 1 - p : p
}

/**
 * Resolves offsets on both axes, as useScroll reports the target's progress
 * on each (#2546). `axis` only picks which progress scroll() reports.
 */
export function resolveOffsets(
    info: ScrollInfo,
    { offset: offsetDefinition = ScrollOffset.All }: ScrollInfoOptions
) {
    for (const axis in axisKeys) {
        const axisInfo = info[axis as Axis]

        /**
         * Reset the length of the resolved offset array rather than creating a new one.
         */
        axisInfo.offset.length = 0

        /**
         * Populate the offset array by resolving the user's offset definition into
         * a list of pixel scroll offsets.
         */
        for (let i = 0; i < offsetDefinition.length; i++) {
            axisInfo.offset[i] = resolveOffset(
                offsetDefinition[i],
                axisInfo.containerLength,
                axisInfo.targetLength,
                axisInfo.targetOffset
            )
        }

        axisInfo.progress = clamp(
            0,
            1,
            offsetsToProgress(axisInfo.offset, axisInfo.current)
        )
    }
}
