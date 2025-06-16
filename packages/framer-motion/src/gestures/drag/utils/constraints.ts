import type { DragElastic, ResolvedConstraints } from "motion-dom"
import { mixNumber } from "motion-dom"
import {
    Axis,
    BoundingBox,
    Box,
    progress as calcProgress,
    clamp,
    Point,
} from "motion-utils"
import { calcLength } from "../../../projection/geometry/delta-calc"

/**
 * Apply constraints to a point. These constraints are both physical along an
 * axis, and an elastic factor that determines how much to constrain the point
 * by if it does lie outside the defined parameters.
 */
export function applyConstraints(
    point: number,
    { min, max }: Partial<Axis>,
    elastic?: Axis
): number {
    if (min !== undefined && point < min) {
        // If we have a min point defined, and this is outside of that, constrain
        point = elastic
            ? mixNumber(min, point, elastic.min)
            : Math.max(point, min)
    } else if (max !== undefined && point > max) {
        // If we have a max point defined, and this is outside of that, constrain
        point = elastic
            ? mixNumber(max, point, elastic.max)
            : Math.min(point, max)
    }

    return point
}

/**
 * Calculates a min projection point based on a pointer, pointer progress
 * within the drag target, and constraints.
 *
 * For instance if an element was 100px width, we were dragging from 0.25
 * along this axis, the pointer is at 200px, and there were no constraints,
 * we would calculate a min projection point of 175px.
 */
export function calcConstrainedMinPoint(
    point: number,
    length: number,
    progress: number,
    constraints?: Partial<Axis>,
    elastic?: Axis
): number {
    // Calculate a min point for this axis and apply it to the current pointer
    const min = point - length * progress

    return constraints ? applyConstraints(min, constraints, elastic) : min
}

/**
 * Calculate constraints in terms of the viewport when defined relatively to the
 * measured axis. This is measured from the nearest edge, so a max constraint of 200
 * on an axis with a max value of 300 would return a constraint of 500 - axis length
 */
export function calcRelativeAxisConstraints(
    axis: Axis,
    min?: number,
    max?: number
): Partial<Axis> {
    return {
        min: min !== undefined ? axis.min + min : undefined,
        max:
            max !== undefined
                ? axis.max + max - (axis.max - axis.min)
                : undefined,
    }
}

/**
 * Calculate constraints in terms of the viewport when
 * defined relatively to the measured bounding box.
 */
export function calcRelativeConstraints(
    layoutBox: Box,
    { top, left, bottom, right }: Partial<BoundingBox>
): ResolvedConstraints {
    return {
        x: calcRelativeAxisConstraints(layoutBox.x, left, right),
        y: calcRelativeAxisConstraints(layoutBox.y, top, bottom),
    }
}

/**
 * Calculate viewport constraints when defined as another viewport-relative axis
 */
export function calcViewportAxisConstraints(
    layoutAxis: Axis,
    constraintsAxis: Axis
) {
    let min = constraintsAxis.min - layoutAxis.min
    let max = constraintsAxis.max - layoutAxis.max

    // If the constraints axis is actually smaller than the layout axis then we can
    // flip the constraints
    if (
        constraintsAxis.max - constraintsAxis.min <
        layoutAxis.max - layoutAxis.min
    ) {
        ;[min, max] = [max, min]
    }

    return { min, max }
}

/**
 * Calculate viewport constraints when defined as another viewport-relative box
 */
export function calcViewportConstraints(layoutBox: Box, constraintsBox: Box) {
    return {
        x: calcViewportAxisConstraints(layoutBox.x, constraintsBox.x),
        y: calcViewportAxisConstraints(layoutBox.y, constraintsBox.y),
    }
}

/**
 * Calculate a transform origin relative to the source axis, between 0-1, that results
 * in an asthetically pleasing scale/transform needed to project from source to target.
 */
export function calcOrigin(source: Axis, target: Axis): number {
    let origin = 0.5
    const sourceLength = calcLength(source)
    const targetLength = calcLength(target)

    if (targetLength > sourceLength) {
        origin = calcProgress(target.min, target.max - sourceLength, source.min)
    } else if (sourceLength > targetLength) {
        origin = calcProgress(source.min, source.max - targetLength, target.min)
    }

    return clamp(0, 1, origin)
}

/**
 * Calculate the relative progress of one constraints box relative to another.
 * Imagine a page scroll bar. At the top, this would return 0, at the bottom, 1.
 * Anywhere in-between, a value between 0 and 1.
 *
 * This also handles flipped constraints, for instance a draggable container within
 * a smaller viewport like a scrollable view.
 */
export function calcProgressWithinConstraints(
    layoutBox: Box,
    constraintsBox: Box
): Point {
    return {
        x: calcOrigin(layoutBox.x, constraintsBox.x),
        y: calcOrigin(layoutBox.y, constraintsBox.y),
    }
}

/**
 * Calculate the an axis position based on two axes and a progress value.
 */
export function calcPositionFromProgress(
    axis: Axis,
    constraints: Axis,
    progress: number
): Axis {
    const axisLength = axis.max - axis.min
    const min = mixNumber(
        constraints.min,
        constraints.max - axisLength,
        progress
    )
    return { min, max: min + axisLength }
}

/**
 * Rebase the calculated viewport constraints relative to the layout.min point.
 */
export function rebaseAxisConstraints(
    layout: Axis,
    constraints: Partial<Axis>
): Partial<Axis> {
    const relativeConstraints: Partial<Axis> = {}

    if (constraints.min !== undefined) {
        relativeConstraints.min = constraints.min - layout.min
    }

    if (constraints.max !== undefined) {
        relativeConstraints.max = constraints.max - layout.min
    }

    return relativeConstraints
}

export const defaultElastic = 0.35
/**
 * Accepts a dragElastic prop and returns resolved elastic values for each axis.
 */
export function resolveDragElastic(
    dragElastic: DragElastic = defaultElastic
): Box {
    if (dragElastic === false) {
        dragElastic = 0
    } else if (dragElastic === true) {
        dragElastic = defaultElastic
    }

    return {
        x: resolveAxisElastic(dragElastic, "left", "right"),
        y: resolveAxisElastic(dragElastic, "top", "bottom"),
    }
}

export function resolveAxisElastic(
    dragElastic: DragElastic,
    minLabel: string,
    maxLabel: string
): Axis {
    return {
        min: resolvePointElastic(dragElastic, minLabel),
        max: resolvePointElastic(dragElastic, maxLabel),
    }
}

export function resolvePointElastic(
    dragElastic: DragElastic,
    label: string
): number {
    return typeof dragElastic === "number"
        ? dragElastic
        : dragElastic[label as keyof typeof dragElastic] || 0
}
