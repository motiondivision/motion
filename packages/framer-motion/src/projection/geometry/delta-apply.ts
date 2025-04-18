import { mixNumber } from "motion-dom"
import { Axis, Box, Delta, Point } from "motion-utils"
import { ResolvedValues } from "../../render/types"
import { IProjectionNode } from "../node/types"
import { hasTransform } from "../utils/has-transform"

/**
 * Scales a point based on a factor and an originPoint
 */
export function scalePoint(point: number, scale: number, originPoint: number) {
    const distanceFromOrigin = point - originPoint
    const scaled = scale * distanceFromOrigin
    return originPoint + scaled
}

/**
 * Applies a translate/scale delta to a point
 */
export function applyPointDelta(
    point: number,
    translate: number,
    scale: number,
    originPoint: number,
    boxScale?: number
): number {
    if (boxScale !== undefined) {
        point = scalePoint(point, boxScale, originPoint)
    }

    return scalePoint(point, scale, originPoint) + translate
}

/**
 * Applies a translate/scale delta to an axis
 */
export function applyAxisDelta(
    axis: Axis,
    translate: number = 0,
    scale: number = 1,
    originPoint: number,
    boxScale?: number
): void {
    axis.min = applyPointDelta(
        axis.min,
        translate,
        scale,
        originPoint,
        boxScale
    )

    axis.max = applyPointDelta(
        axis.max,
        translate,
        scale,
        originPoint,
        boxScale
    )
}

/**
 * Applies a translate/scale delta to a box
 */
export function applyBoxDelta(box: Box, { x, y }: Delta): void {
    applyAxisDelta(box.x, x.translate, x.scale, x.originPoint)
    applyAxisDelta(box.y, y.translate, y.scale, y.originPoint)
}

const TREE_SCALE_SNAP_MIN = 0.999999999999
const TREE_SCALE_SNAP_MAX = 1.0000000000001

/**
 * Apply a tree of deltas to a box. We do this to calculate the effect of all the transforms
 * in a tree upon our box before then calculating how to project it into our desired viewport-relative box
 *
 * This is the final nested loop within updateLayoutDelta for future refactoring
 */
export function applyTreeDeltas(
    box: Box,
    treeScale: Point,
    treePath: IProjectionNode[],
    isSharedTransition: boolean = false
) {
    const treeLength = treePath.length
    if (!treeLength) return

    // Reset the treeScale
    treeScale.x = treeScale.y = 1

    let node: IProjectionNode
    let delta: Delta | undefined

    for (let i = 0; i < treeLength; i++) {
        node = treePath[i]
        delta = node.projectionDelta

        /**
         * TODO: Prefer to remove this, but currently we have motion components with
         * display: contents in Framer.
         */
        const { visualElement } = node.options
        if (
            visualElement &&
            visualElement.props.style &&
            visualElement.props.style.display === "contents"
        ) {
            continue
        }

        if (
            isSharedTransition &&
            node.options.layoutScroll &&
            node.scroll &&
            node !== node.root
        ) {
            transformBox(box, {
                x: -node.scroll.offset.x,
                y: -node.scroll.offset.y,
            })
        }

        if (delta) {
            // Incoporate each ancestor's scale into a culmulative treeScale for this component
            treeScale.x *= delta.x.scale
            treeScale.y *= delta.y.scale

            // Apply each ancestor's calculated delta into this component's recorded layout box
            applyBoxDelta(box, delta)
        }

        if (isSharedTransition && hasTransform(node.latestValues)) {
            transformBox(box, node.latestValues)
        }
    }

    /**
     * Snap tree scale back to 1 if it's within a non-perceivable threshold.
     * This will help reduce useless scales getting rendered.
     */
    if (
        treeScale.x < TREE_SCALE_SNAP_MAX &&
        treeScale.x > TREE_SCALE_SNAP_MIN
    ) {
        treeScale.x = 1.0
    }
    if (
        treeScale.y < TREE_SCALE_SNAP_MAX &&
        treeScale.y > TREE_SCALE_SNAP_MIN
    ) {
        treeScale.y = 1.0
    }
}

export function translateAxis(axis: Axis, distance: number) {
    axis.min = axis.min + distance
    axis.max = axis.max + distance
}

/**
 * Apply a transform to an axis from the latest resolved motion values.
 * This function basically acts as a bridge between a flat motion value map
 * and applyAxisDelta
 */
export function transformAxis(
    axis: Axis,
    axisTranslate?: number,
    axisScale?: number,
    boxScale?: number,
    axisOrigin: number = 0.5
): void {
    const originPoint = mixNumber(axis.min, axis.max, axisOrigin)

    // Apply the axis delta to the final axis
    applyAxisDelta(axis, axisTranslate, axisScale, originPoint, boxScale)
}

/**
 * Apply a transform to a box from the latest resolved motion values.
 */
export function transformBox(box: Box, transform: ResolvedValues) {
    transformAxis(
        box.x,
        transform.x as number,
        transform.scaleX as number,
        transform.scale as number,
        transform.originX as number
    )
    transformAxis(
        box.y,
        transform.y as number,
        transform.scaleY as number,
        transform.scale as number,
        transform.originY as number
    )
}
