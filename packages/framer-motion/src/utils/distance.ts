import { Point } from "motion-utils"

export const distance = (a: number, b: number) => Math.abs(a - b)

export function distance2D(a: Point, b: Point): number {
    // Multi-dimensional
    const xDelta = distance(a.x, b.x)
    const yDelta = distance(a.y, b.y)
    return Math.sqrt(xDelta ** 2 + yDelta ** 2)
}
