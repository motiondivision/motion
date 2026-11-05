import type { Box } from "motion-utils"
import { identity, Mat3, multiply, rectToUnit } from "./mat3"

/**
 * Four corners of a flat element as it appears on the page, clockwise
 * from top-left: x0 y0 (top-left), x1 y1 (top-right), x2 y2 (bottom-right),
 * x3 y3 (bottom-left).
 */
export type Quad = Float64Array

export const createQuad = (): Quad => new Float64Array(8)

export function quadFromBox(out: Quad, { x, y }: Box): Quad {
    out[0] = out[6] = x.min
    out[2] = out[4] = x.max
    out[1] = out[3] = y.min
    out[5] = out[7] = y.max
    return out
}

export function copyQuad(out: Quad, quad: Quad): Quad {
    for (let i = 0; i < 8; i++) out[i] = quad[i]
    return out
}

/**
 * Project the point (x, y) through `m` into `out` at `offset`. Returns
 * false if the point is at or behind the viewer.
 */
export function projectPoint(
    m: Mat3,
    x: number,
    y: number,
    out: Float64Array,
    offset: number
): boolean {
    const w = m[6] * x + m[7] * y + m[8]
    out[offset] = (m[0] * x + m[1] * y + m[2]) / w
    out[offset + 1] = (m[3] * x + m[4] * y + m[5]) / w
    return w > 0
}

/**
 * Project the corners of `box` through `m`. Returns false if any corner is
 * at or behind the viewer.
 */
export function transformBoxToQuad(out: Quad, m: Mat3, { x, y }: Box) {
    let visible = projectPoint(m, x.min, y.min, out, 0)
    visible = projectPoint(m, x.max, y.min, out, 2) && visible
    visible = projectPoint(m, x.max, y.max, out, 4) && visible
    return projectPoint(m, x.min, y.max, out, 6) && visible
}

export function transformQuad(out: Quad, m: Mat3, quad: Quad) {
    let visible = true
    for (let i = 0; i < 8; i += 2) {
        visible = projectPoint(m, quad[i], quad[i + 1], out, i) && visible
    }
    return visible
}

/**
 * The axis-aligned bounding box of `quad`.
 */
export function quadBounds(out: Box, quad: Quad): Box {
    out.x.min = Math.min(quad[0], quad[2], quad[4], quad[6])
    out.x.max = Math.max(quad[0], quad[2], quad[4], quad[6])
    out.y.min = Math.min(quad[1], quad[3], quad[5], quad[7])
    out.y.max = Math.max(quad[1], quad[3], quad[5], quad[7])
    return out
}

export function quadEquals(a: Quad, b: Quad, epsilon = 0) {
    for (let i = 0; i < 8; i++) {
        if (Math.abs(a[i] - b[i]) > epsilon) return false
    }
    return true
}

/**
 * The homography that maps the unit square's corners (0, 0), (1, 0),
 * (1, 1), (0, 1) onto `quad`. Paul Heckbert, "Fundamentals of Texture
 * Mapping and Image Warping" (1989), section 2.2.3.
 *
 * Returns false if three corners are collinear.
 */
export function unitToQuad(out: Mat3, quad: Quad): boolean {
    const x0 = quad[0],
        y0 = quad[1],
        x1 = quad[2],
        y1 = quad[3],
        x2 = quad[4],
        y2 = quad[5],
        x3 = quad[6],
        y3 = quad[7]

    const sx = x0 - x1 + x2 - x3
    const sy = y0 - y1 + y2 - y3

    let g = 0
    let h = 0

    if (sx !== 0 || sy !== 0) {
        const dx1 = x1 - x2
        const dx2 = x3 - x2
        const dy1 = y1 - y2
        const dy2 = y3 - y2
        const det = dx1 * dy2 - dx2 * dy1
        if (!det) return false
        g = (sx * dy2 - dx2 * sy) / det
        h = (dx1 * sy - sx * dy1) / det
    }

    out[0] = x1 - x0 + g * x1
    out[1] = x3 - x0 + h * x3
    out[2] = x0
    out[3] = y1 - y0 + g * y1
    out[4] = y3 - y0 + h * y3
    out[5] = y0
    out[6] = g
    out[7] = h
    out[8] = 1

    const det =
        out[0] * (out[4] - out[5] * h) -
        out[1] * (out[3] - out[5] * g) +
        x0 * (out[3] * h - out[4] * g)

    return det !== 0 && isFinite(det)
}

const unit = /* @__PURE__ */ new Float64Array(9)

/**
 * The homography that maps `box` onto `quad`, corner to corner.
 */
export function boxToQuad(out: Mat3, { x, y }: Box, quad: Quad): boolean {
    const width = x.max - x.min
    const height = y.max - y.min
    if (!width || !height || !unitToQuad(out, quad)) {
        identity(out)
        return false
    }
    multiply(out, out, rectToUnit(unit, x.min, y.min, width, height))
    return true
}
