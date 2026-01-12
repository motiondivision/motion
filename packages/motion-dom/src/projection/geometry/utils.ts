import { Axis, AxisDelta, Box, Delta } from "motion-utils"
import { calcLength } from "./delta-calc"

function isAxisDeltaZero(delta: AxisDelta) {
    return delta.translate === 0 && delta.scale === 1
}

export function isDeltaZero(delta: Delta) {
    return isAxisDeltaZero(delta.x) && isAxisDeltaZero(delta.y)
}

export function axisEquals(a: Axis, b: Axis) {
    return a.min === b.min && a.max === b.max
}

export function boxEquals(a: Box, b: Box) {
    return axisEquals(a.x, b.x) && axisEquals(a.y, b.y)
}

export function axisEqualsRounded(a: Axis, b: Axis) {
    return (
        Math.round(a.min) === Math.round(b.min) &&
        Math.round(a.max) === Math.round(b.max)
    )
}

export function boxEqualsRounded(a: Box, b: Box) {
    return axisEqualsRounded(a.x, b.x) && axisEqualsRounded(a.y, b.y)
}

export function aspectRatio(box: Box): number {
    return calcLength(box.x) / calcLength(box.y)
}

export function axisDeltaEquals(a: AxisDelta, b: AxisDelta) {
    return (
        a.translate === b.translate &&
        a.scale === b.scale &&
        a.originPoint === b.originPoint
    )
}
