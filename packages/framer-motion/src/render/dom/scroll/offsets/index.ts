import { clamp, progress } from "motion-utils"
import { ScrollInfo, ScrollInfoOptions } from "../types"
import { calcInset } from "./inset"
import { resolveOffset } from "./offset"
import { ScrollOffset } from "./presets"

const point = { x: 0, y: 0 }

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

function getTargetSize(target: Element) {
    return "getBBox" in target && target.tagName !== "svg"
        ? (target as SVGGraphicsElement).getBBox()
        : { width: target.clientWidth, height: target.clientHeight }
}

export function resolveOffsets(
    container: Element,
    info: ScrollInfo,
    options: ScrollInfoOptions
) {
    const { offset: offsetDefinition = ScrollOffset.All } = options
    const { target = container, axis = "y" } = options
    const lengthLabel = axis === "y" ? "height" : "width"

    const inset = target !== container ? calcInset(target, container) : point

    /**
     * Measure the target and container. If they're the same thing then we
     * use the container's scrollWidth/Height as the target, from there
     * all other calculations can remain the same.
     */
    const targetSize =
        target === container
            ? { width: container.scrollWidth, height: container.scrollHeight }
            : getTargetSize(target)

    const containerSize = {
        width: container.clientWidth,
        height: container.clientHeight,
    }

    /**
     * Reset the length of the resolved offset array rather than creating a new one.
     * TODO: More reusable data structures for targetSize/containerSize would also be good.
     */
    info[axis].offset.length = 0

    /**
     * Populate the offset array by resolving the user's offset definition into
     * a list of pixel scroll offsets.
     */
    const numOffsets = offsetDefinition.length
    for (let i = 0; i < numOffsets; i++) {
        info[axis].offset[i] = resolveOffset(
            offsetDefinition[i],
            containerSize[lengthLabel],
            targetSize[lengthLabel],
            inset[axis]
        )
    }

    info[axis].progress = clamp(
        0,
        1,
        offsetsToProgress(info[axis].offset, info[axis].current)
    )
}
