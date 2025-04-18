import { mixNumber } from "motion-dom"
import { Axis, AxisDelta, Box, Delta } from "motion-utils"
import { ResolvedValues } from "../../render/types"

const SCALE_PRECISION = 0.0001
const SCALE_MIN = 1 - SCALE_PRECISION
const SCALE_MAX = 1 + SCALE_PRECISION
const TRANSLATE_PRECISION = 0.01
const TRANSLATE_MIN = 0 - TRANSLATE_PRECISION
const TRANSLATE_MAX = 0 + TRANSLATE_PRECISION

export function calcLength(axis: Axis) {
    return axis.max - axis.min
}

export function isNear(
    value: number,
    target: number,
    maxDistance: number
): boolean {
    return Math.abs(value - target) <= maxDistance
}

export function calcAxisDelta(
    delta: AxisDelta,
    source: Axis,
    target: Axis,
    origin: number = 0.5
) {
    delta.origin = origin
    delta.originPoint = mixNumber(source.min, source.max, delta.origin)
    delta.scale = calcLength(target) / calcLength(source)
    delta.translate =
        mixNumber(target.min, target.max, delta.origin) - delta.originPoint

    if (
        (delta.scale >= SCALE_MIN && delta.scale <= SCALE_MAX) ||
        isNaN(delta.scale)
    ) {
        delta.scale = 1.0
    }

    if (
        (delta.translate >= TRANSLATE_MIN &&
            delta.translate <= TRANSLATE_MAX) ||
        isNaN(delta.translate)
    ) {
        delta.translate = 0.0
    }
}

export function calcBoxDelta(
    delta: Delta,
    source: Box,
    target: Box,
    origin?: ResolvedValues
): void {
    calcAxisDelta(
        delta.x,
        source.x,
        target.x,
        origin ? (origin.originX as number) : undefined
    )
    calcAxisDelta(
        delta.y,
        source.y,
        target.y,
        origin ? (origin.originY as number) : undefined
    )
}

export function calcRelativeAxis(target: Axis, relative: Axis, parent: Axis) {
    target.min = parent.min + relative.min
    target.max = target.min + calcLength(relative)
}

export function calcRelativeBox(target: Box, relative: Box, parent: Box) {
    calcRelativeAxis(target.x, relative.x, parent.x)
    calcRelativeAxis(target.y, relative.y, parent.y)
}

export function calcRelativeAxisPosition(
    target: Axis,
    layout: Axis,
    parent: Axis
) {
    target.min = layout.min - parent.min
    target.max = target.min + calcLength(layout)
}

export function calcRelativePosition(target: Box, layout: Box, parent: Box) {
    calcRelativeAxisPosition(target.x, layout.x, parent.x)
    calcRelativeAxisPosition(target.y, layout.y, parent.y)
}
