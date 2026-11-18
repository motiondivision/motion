import { calcLength } from "../../../projection/geometry/delta-calc"
import { mixNumber } from "../../../utils/mix/number"
import type { DragElastic } from "../types"
import { Axis, Box, progress as calcProgress, clamp } from "motion-utils"

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
 * The constraints of an axis when they're defined relative to where the
 * element is laid out, which is the space its x and y values are in. An
 * edge that isn't defined is left out, as inertia takes one it isn't
 * given from `dragTransition`.
 */
export function calcRelativeAxisConstraints(
    min?: number,
    max?: number
): Partial<Axis> {
    const constraints: Partial<Axis> = {}
    if (min !== undefined) constraints.min = min
    if (max !== undefined) constraints.max = max
    return constraints
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
 * in an aesthetically pleasing scale/transform needed to project from source to target.
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
