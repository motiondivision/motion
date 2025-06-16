import { BezierDefinition, Easing } from "../types"

export const isBezierDefinition = (
    easing: Easing | Easing[]
): easing is BezierDefinition =>
    Array.isArray(easing) && typeof easing[0] === "number"
