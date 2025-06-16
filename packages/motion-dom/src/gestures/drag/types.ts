import { Axis, BoundingBox } from "motion-utils"
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
