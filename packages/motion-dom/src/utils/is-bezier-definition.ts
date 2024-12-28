import { BezierDefinition, Easing } from "../animation/types"

export const isBezierDefinition = (
    easing: Easing | Easing[]
): easing is BezierDefinition =>
    Array.isArray(easing) && typeof easing[0] === "number"
