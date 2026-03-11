import { Axis, AxisDelta, Box } from "motion-utils"

/**
 * Reset an axis to the provided origin box.
 *
 * This is a mutative operation.
 */
export function copyAxisInto(axis: Axis, originAxis: Axis) {
    axis.min = originAxis.min
    axis.max = originAxis.max
}

/**
 * Reset a box to the provided origin box.
 *
 * This is a mutative operation.
 */
export function copyBoxInto(box: Box, originBox: Box) {
    copyAxisInto(box.x, originBox.x)
    copyAxisInto(box.y, originBox.y)
}

/**
 * Reset a delta to the provided origin box.
 *
 * This is a mutative operation.
 */
export function copyAxisDeltaInto(delta: AxisDelta, originDelta: AxisDelta) {
    delta.translate = originDelta.translate
    delta.scale = originDelta.scale
    delta.originPoint = originDelta.originPoint
    delta.origin = originDelta.origin
}
