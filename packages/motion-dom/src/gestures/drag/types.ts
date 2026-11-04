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
 * to a box. Drag writes the pointer's position (in `x`/`y` motion value
 * space) to `x` and `y`, then calls `move()`, which sets the motion values.
 * On release, `release()` takes over with the release velocity (masked by
 * the drag axes, direction lock and `dragMomentum`) and the inertia
 * options, and drag fires `onDragTransitionEnd` once it resolves.
 */
export interface DragPointConstraint extends Point {
    move(): void
    release(velocity: Point, transition: InertiaOptions): Promise<unknown>
}

/**
 * What a drag gives a `DragConstraintsFunction` when it starts.
 */
export interface DragConstraintsContext {
    visualElement: VisualElementDragControls["visualElement"]

    /**
     * The `x`/`y` values the drag started from. A layout change mid-drag
     * shifts them to keep the element where it's drawn.
     */
    originPoint: Point

    /**
     * The per-axis, per-side elastic.
     */
    elastic: VisualElementDragControls["elastic"]

    getAxisMotionValue: VisualElementDragControls["getAxisMotionValue"]
}

/**
 * Called when a drag starts, after the drag's origin and elastic are
 * resolved.
 */
export type DragConstraintsFunction = (
    controls: DragConstraintsContext
) => DragPointConstraint
