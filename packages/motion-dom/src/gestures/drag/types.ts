import { Axis, BoundingBox, Point } from "motion-utils"
import type { InertiaOptions } from "../../animation/types"
import type { VisualElementDragControls } from "./VisualElementDragControls"
import type { PanInfo } from "../pan/types"

export type DragHandler = (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
) => void

export type DragElastic = boolean | number | Partial<BoundingBox>

export interface ResolvedConstraints {
    x: Partial<Axis>
    y: Partial<Axis>
}

export interface ResolvedElastic {
    x: Axis
    y: Axis
}

/**
 * A constraint drag hands the pointer to, rather than clamping each axis
 * to a box, as made by `pathConstraints()`. Drag writes the pointer's
 * position (in `x`/`y` motion value space) to `x` and `y`, then calls
 * `move()` to set the motion values.
 */
export interface DragPointConstraint extends Point {
    move(): void
    release(velocity: Point, transition: InertiaOptions): Promise<unknown>
}

/**
 * Called when a drag starts, after the drag's origin and elastic are
 * resolved.
 */
export type DragConstraintsFunction = (
    controls: VisualElementDragControls
) => DragPointConstraint
