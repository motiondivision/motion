import { warnOnce } from "motion-utils"
import { Axis, axisKeys } from "./info"
import { resolveOffsets } from "./offsets/index"
import { calcInset } from "./offsets/inset"
import {
    OnScrollHandler,
    OnScrollInfo,
    ScrollInfo,
    ScrollInfoOptions,
} from "./types"

function getTargetSize(target: Element) {
    return "getBBox" in target && target.tagName !== "svg"
        ? (target as SVGGraphicsElement).getBBox()
        : { width: target.clientWidth, height: target.clientHeight }
}

export function createOnScrollHandler(
    container: Element,
    onScroll: OnScrollInfo,
    info: ScrollInfo,
    options: ScrollInfoOptions = {}
): OnScrollHandler {
    const { target } = options

    /**
     * In development mode ensure scroll containers aren't position: static as this makes
     * it difficult to measure their relative positions. The document scrolling element
     * is exempt: offsetParent measurements naturally resolve relative to the document.
     */
    if (process.env.NODE_ENV !== "production") {
        if (
            target &&
            target !== container &&
            container !== document.documentElement &&
            container !== document.scrollingElement &&
            container !== document.body
        ) {
            warnOnce(
                getComputedStyle(container).position !== "static",
                "Please ensure that the container has a non-static position, like 'relative', 'fixed', or 'absolute' to ensure scroll offset is calculated correctly."
            )
        }
    }

    /**
     * Handlers without a target or offset are notified with the container's
     * shared info object, so they measure nothing themselves.
     */
    const needsOwnInfo = target || options.offset

    return {
        measure: (containerInfo) => {
            if (!needsOwnInfo) return

            info.time = containerInfo.time
            for (const key in axisKeys) {
                const axis = key as Axis
                const { offset } = info[axis]
                Object.assign(info[axis], containerInfo[axis])
                info[axis].offset = offset
            }

            if (target && target !== container) {
                const inset = calcInset(target, container)
                const size = getTargetSize(target)
                info.x.targetOffset = inset.x
                info.y.targetOffset = inset.y
                info.x.targetLength = size.width
                info.y.targetLength = size.height
            }

            resolveOffsets(info, options)
        },
        notify: (containerInfo) =>
            onScroll(needsOwnInfo ? info : containerInfo),
    }
}
