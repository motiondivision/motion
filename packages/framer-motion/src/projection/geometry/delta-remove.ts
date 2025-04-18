import { mixNumber, percent } from "motion-dom"
import { Axis, Box } from "motion-utils"
import { ResolvedValues } from "../../render/types"
import { scalePoint } from "./delta-apply"

/**
 * Remove a delta from a point. This is essentially the steps of applyPointDelta in reverse
 */
export function removePointDelta(
    point: number,
    translate: number,
    scale: number,
    originPoint: number,
    boxScale?: number
): number {
    point -= translate
    point = scalePoint(point, 1 / scale, originPoint)

    if (boxScale !== undefined) {
        point = scalePoint(point, 1 / boxScale, originPoint)
    }

    return point
}

/**
 * Remove a delta from an axis. This is essentially the steps of applyAxisDelta in reverse
 */
export function removeAxisDelta(
    axis: Axis,
    translate: number | string = 0,
    scale: number = 1,
    origin: number = 0.5,
    boxScale?: number,
    originAxis: Axis = axis,
    sourceAxis: Axis = axis
): void {
    if (percent.test(translate)) {
        translate = parseFloat(translate as string)
        const relativeProgress = mixNumber(
            sourceAxis.min,
            sourceAxis.max,
            translate / 100
        )
        translate = relativeProgress - sourceAxis.min
    }

    if (typeof translate !== "number") return

    let originPoint = mixNumber(originAxis.min, originAxis.max, origin)
    if (axis === originAxis) originPoint -= translate

    axis.min = removePointDelta(
        axis.min,
        translate,
        scale,
        originPoint,
        boxScale
    )

    axis.max = removePointDelta(
        axis.max,
        translate,
        scale,
        originPoint,
        boxScale
    )
}

/**
 * Remove a transforms from an axis. This is essentially the steps of applyAxisTransforms in reverse
 * and acts as a bridge between motion values and removeAxisDelta
 */
export function removeAxisTransforms(
    axis: Axis,
    transforms: ResolvedValues,
    [key, scaleKey, originKey]: string[],
    origin?: Axis,
    sourceAxis?: Axis
) {
    removeAxisDelta(
        axis,
        transforms[key] as number,
        transforms[scaleKey] as number,
        transforms[originKey] as number,
        transforms.scale as number,
        origin,
        sourceAxis
    )
}

/**
 * The names of the motion values we want to apply as translation, scale and origin.
 */
const xKeys = ["x", "scaleX", "originX"]
const yKeys = ["y", "scaleY", "originY"]

/**
 * Remove a transforms from an box. This is essentially the steps of applyAxisBox in reverse
 * and acts as a bridge between motion values and removeAxisDelta
 */
export function removeBoxTransforms(
    box: Box,
    transforms: ResolvedValues,
    originBox?: Box,
    sourceBox?: Box
): void {
    removeAxisTransforms(
        box.x,
        transforms,
        xKeys,
        originBox ? originBox.x : undefined,
        sourceBox ? sourceBox.x : undefined
    )
    removeAxisTransforms(
        box.y,
        transforms,
        yKeys,
        originBox ? originBox.y : undefined,
        sourceBox ? sourceBox.y : undefined
    )
}
