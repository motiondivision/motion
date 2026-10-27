import type { Subpath } from "./parse"

/**
 * Points are stored flat, [x0, y0, x1, y1, ...]. Closed polylines don't
 * repeat their first point.
 */
export type Points = number[]

export interface Contour {
    points: Points
    closed: boolean
    /**
     * Signed area: its sign is the winding direction. 0 for open paths.
     */
    area: number
    x: number
    y: number
    size: number
    children: Contour[]
    /**
     * How far along the path each point is, from 0 to 1. Each of the
     * path's curves that goes anywhere takes an equal share, gone through
     * evenly by its own parameter, as the path was drawn.
     */
    along: number[]
}

export const hypot = Math.hypot

/**
 * Holes are placed among at most this many of their outline's points.
 */
export const CAGE = 64

/**
 * Flatten cubics into a polyline whose distance from the curve stays
 * under `tolerance`, then split edges longer than 1/`detail` of the
 * perimeter. Short edges and corners are kept as they are, so features
 * survive and long sides get enough points to match against. Returns the
 * polyline and how far along the path each point is.
 */
export function flatten(
    { segments, closed }: Subpath,
    tolerance: number,
    detail: number
): [Points, number[]] {
    const points: Points = []
    const along: number[] = []
    let share = 0
    const add = (px: number, py: number) => {
        const n = points.length
        if (!n || px !== points[n - 2] || py !== points[n - 1]) {
            points.push(px, py)
            along.push(share)
        }
    }

    // Curves that don't move take no share
    const drawn = segments.filter((c) => c.some((v, i) => v !== c[i & 1]))
    add(segments[0][0], segments[0][1])
    drawn.forEach(([x0, y0, x1, y1, x2, y2, x3, y3], s) => {
        // Second differences bound how far a uniform split strays from the curve
        const dd = hypot(
            Math.max(Math.abs(x0 - 2 * x1 + x2), Math.abs(x1 - 2 * x2 + x3)),
            Math.max(Math.abs(y0 - 2 * y1 + y2), Math.abs(y1 - 2 * y2 + y3))
        )
        const steps = Math.min(
            64,
            Math.ceil(Math.sqrt((0.75 * dd) / tolerance)) || 1
        )
        for (let i = 1; i <= steps; i++) {
            const t = i / steps
            const u = 1 - t
            const a = u * u * u
            const b = 3 * u * u * t
            const c = 3 * u * t * t
            const e = t * t * t
            share = (s + t) / drawn.length
            add(
                a * x0 + b * x1 + c * x2 + e * x3,
                a * y0 + b * y1 + c * y2 + e * y3
            )
        }
    })

    const n = points.length
    if (
        closed &&
        n > 2 &&
        points[0] === points[n - 2] &&
        points[1] === points[n - 1]
    ) {
        points.length -= 2
        along.pop()
    }

    const maxLength = perimeter(points, closed) / detail
    if (!maxLength) return [points, along]

    const split: Points = []
    const splitAlong: number[] = []
    const count = points.length / 2
    for (let i = 0; i < count; i++) {
        const x = points[2 * i]
        const y = points[2 * i + 1]
        split.push(x, y)
        splitAlong.push(along[i])
        if (i < count - 1 || closed) {
            const j = (2 * i + 2) % points.length
            const dx = points[j] - x
            const dy = points[j + 1] - y
            const pieces = Math.ceil(hypot(dx, dy) / maxLength)
            for (let k = 1; k < pieces; k++) {
                split.push(x + (dx * k) / pieces, y + (dy * k) / pieces)
                splitAlong.push(
                    along[i] + (((along[i + 1] ?? 1) - along[i]) * k) / pieces
                )
            }
        }
    }
    return [split, splitAlong]
}

export function perimeter(points: Points, closed: boolean) {
    let length = 0
    const n = points.length
    for (let i = 2; i < n + (closed ? 2 : 0); i += 2) {
        length += hypot(
            points[i % n] - points[i - 2],
            points[(i + 1) % n] - points[i - 1]
        )
    }
    return length
}

export function contour(
    points: Points,
    closed: boolean,
    along: number[] = []
): Contour {
    const n = points.length
    let area = 0
    let x = 0
    let y = 0
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < n; i += 2) {
        const px = points[i]
        const py = points[i + 1]
        if (closed) area += px * points[(i + 3) % n] - points[(i + 2) % n] * py
        x += px
        y += py
        minX = Math.min(minX, px)
        minY = Math.min(minY, py)
        maxX = Math.max(maxX, px)
        maxY = Math.max(maxY, py)
    }
    return {
        points,
        closed,
        area: area / 2,
        x: (2 * x) / n,
        y: (2 * y) / n,
        size: hypot(maxX - minX, maxY - minY),
        children: [],
        along,
    }
}

export function reverse(points: Points): Points {
    const reversed: Points = []
    for (let i = points.length - 2; i >= 0; i -= 2) {
        reversed.push(points[i], points[i + 1])
    }
    return reversed
}

export function isInside(x: number, y: number, points: Points) {
    let inside = false
    const n = points.length
    for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const yi = points[i + 1]
        const yj = points[j + 1]
        if (
            yi > y !== yj > y &&
            x < ((points[j] - points[i]) * (y - yi)) / (yj - yi) + points[i]
        ) {
            inside = !inside
        }
    }
    return inside
}

/**
 * Sort closed contours into a tree, where each contour's children are
 * the contours that lie entirely inside it: holes, and islands in holes.
 */
export function nest(contours: Contour[]): Contour[] {
    const bySize = [...contours].sort(
        (a, b) => Math.abs(b.area) - Math.abs(a.area)
    )
    const roots: Contour[] = []

    for (let i = 0; i < bySize.length; i++) {
        const child = bySize[i]
        let parent: Contour | undefined
        // The smallest larger contour that holds every point of this one
        for (let j = i - 1; j >= 0 && !parent; j--) {
            const candidate = bySize[j]
            if (
                candidate.closed &&
                child.closed &&
                encloses(candidate, child)
            ) {
                parent = candidate
            }
        }
        ;(parent ? parent.children : roots).push(child)
    }

    return roots
}

function encloses(outer: Contour, inner: Contour) {
    const { points } = inner
    for (let i = 0; i < points.length; i += 2) {
        if (!isInside(points[i], points[i + 1], outer.points)) return false
    }
    return true
}

/**
 * Mean value coordinates of a point with respect to a polygon: weights
 * that rebuild the point from the polygon's vertices and move it along
 * as the polygon deforms (Floater 2003).
 */
export function meanValue(x: number, y: number, points: Points) {
    const n = points.length / 2
    const weights = new Float64Array(n)
    const halfTan = new Float64Array(n)
    let sum = 0

    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        const ax = points[2 * i] - x
        const ay = points[2 * i + 1] - y
        const bx = points[2 * j] - x
        const by = points[2 * j + 1] - y
        const a = hypot(ax, ay)
        const b = hypot(bx, by)
        const turn = a * b + ax * bx + ay * by
        // A point on an edge, or a corner, is a blend of the edge's ends
        if (turn <= 1e-9 * a * b && a + b) {
            weights[i] = b / (a + b)
            weights[j] = a / (a + b)
            return weights
        }
        // tan(angle / 2) = cross / (|a||b| + dot)
        halfTan[i] = (ax * by - ay * bx) / turn
    }

    for (let i = 0; i < n; i++) {
        weights[i] =
            (halfTan[(i + n - 1) % n] + halfTan[i]) /
            hypot(points[2 * i] - x, points[2 * i + 1] - y)
        sum += weights[i]
    }

    for (let i = 0; i < n; i++) weights[i] /= sum
    return weights
}

/**
 * A point inside a polygon that, if any can, sees all of it, so the
 * polygon can shrink towards it without leaving itself: the middle of
 * what's left of its bounds once the outside of each edge is cut away.
 * Otherwise (x, y), moved onto the nearest edge if it's outside.
 */
export function within(points: Points, x: number, y: number) {
    const n = points.length
    const { area, x: cx, y: cy, size } = contour(points, true)
    let kernel: Points = [
        cx,
        cy - 2 * size,
        cx + 2 * size,
        cy + size,
        cx - 2 * size,
        cy + size,
    ]
    for (let i = 0; i < n; i += 2) {
        const x0 = points[i]
        const y0 = points[i + 1]
        const dx = points[(i + 2) % n] - x0
        const dy = points[(i + 3) % n] - y0
        const cut: Points = []
        const m = kernel.length
        for (let k = 0; k < m; k += 2) {
            const px = kernel[k]
            const py = kernel[k + 1]
            const qx = kernel[(k + 2) % m]
            const qy = kernel[(k + 3) % m]
            const p = (dx * (py - y0) - dy * (px - x0)) * area
            const q = (dx * (qy - y0) - dy * (qx - x0)) * area
            if (p >= 0) cut.push(px, py)
            if (p * q < 0) {
                cut.push(
                    px + ((qx - px) * p) / (p - q),
                    py + ((qy - py) * p) / (p - q)
                )
            }
        }
        kernel = cut
    }
    const middle = contour(kernel, true)
    return kernel.length
        ? [middle.x, middle.y]
        : isInside(x, y, points)
        ? [x, y]
        : nearest(x, y, points).slice(2)
}

/**
 * How far a hole can be scaled towards (x, y), up to `most`, before it
 * comes within `margin` of its outline: the least scale at which one of
 * its points meets an edge or corner of the outline, or one of its edges
 * meets a corner. A hole that (x, y) sees all of keeps clear of the
 * outline at any smaller scale. Long polylines are thinned first, and the
 * margin is widened by how far they stray from what's left. Unless the
 * hole keeps clear of that, it's checked again, with each thinned only as
 * far as it can be while straying by at most a quarter of the margin.
 */
export function contact(
    hole: Points,
    outer: Points,
    x: number,
    y: number,
    margin: number,
    most: number,
    fine?: boolean,
    top = most
): number {
    const [points, strayA] = sparse(hole, fine ? margin : Infinity)
    const [polygon, strayB] = sparse(outer, fine ? margin : Infinity)
    const stray = strayA + strayB
    const h = points.length
    const n = polygon.length
    let radius = 0
    margin += stray
    for (let i = 0; i < h; i += 2) {
        radius = Math.max(radius, hypot(points[i] - x, points[i + 1] - y))
    }

    for (let j = 0; j < n; j += 2) {
        const ax = polygon[j] - x
        const ay = polygon[j + 1] - y
        const ex = polygon[(j + 2) % n] - x - ax
        const ey = polygon[(j + 3) % n] - y - ay
        const [px, py] = closest(x, y, polygon, j)
        const d = hypot(px - x, py - y)
        // A point this far from (x, y) can't come near the edge any sooner
        const near = d - margin
        if (near >= radius * most) continue
        let next = (points[0] - x) * (px - x) + (points[1] - y) * (py - y)
        for (let i = 0; i < h; i += 2) {
            const ux = points[i] - x
            const uy = points[i + 1] - y
            const ahead = next
            next =
                (points[(i + 2) % h] - x) * (px - x) +
                (points[(i + 3) % h] - y) * (py - y)
            // Nor can this point, or its edge to the next, if they don't
            // reach that far in the direction of the edge's nearest point.
            // Within rounding of (x, y), that has no direction to go by.
            if (near * d <= Math.max(1e-9, ahead, next) * most) {
                most = Math.min(
                    most,
                    meet(ux, uy, ax, ay, margin),
                    touch(ux, uy, ax, ay, ex, ey, margin),
                    touch(
                        ux,
                        uy,
                        ax,
                        ay,
                        points[(i + 2) % h] - x - ux,
                        points[(i + 3) % h] - y - uy,
                        margin,
                        true
                    )
                )
            }
        }
    }
    return most < top && !fine && 4 * Math.max(strayA, strayB) > margin - stray
        ? contact(hole, outer, x, y, margin - stray, top, true)
        : most
}

/**
 * Every few points of a polygon, at most `most` of them, and how many
 * entries apart they are.
 */
export const every = (points: Points, most: number): [Points, number] => {
    const step = 2 * Math.ceil(points.length / 2 / most)
    return [points.filter((_, i) => i % step < 2), step]
}

/**
 * Every few points of a closed polyline, at most `most` of them, and how
 * far it strays from them: twice as many while it strays by more than a
 * quarter of `margin`.
 */
function sparse(
    points: Points,
    margin: number,
    most = 2 * CAGE
): [Points, number] {
    const [kept, step] = every(points, most)
    let stray = 0
    for (let i = 0; i < points.length; i += 2) {
        const [px, py] = closest(
            points[i],
            points[i + 1],
            kept,
            2 * ((i / step) | 0)
        )
        stray = Math.max(stray, hypot(px - points[i], py - points[i + 1]))
    }
    return step > 2 && stray > margin / 4
        ? sparse(points, margin, most * 2)
        : [kept, stray]
}

/**
 * The least s >= 0 at which s·(ux, uy) comes within `margin` of (ax, ay).
 */
function meet(ux: number, uy: number, ax: number, ay: number, margin: number) {
    const uu = ux * ux + uy * uy
    const ua = ux * ax + uy * ay
    const aa = ax * ax + ay * ay - margin * margin
    const d = ua * ua - uu * aa
    return aa <= 0 ? 0 : d >= 0 && ua > 0 ? (ua - Math.sqrt(d)) / uu : Infinity
}

/**
 * The least s >= 0 at which s·(ux, uy) comes within `margin` of the edge
 * from (ax, ay) along (ex, ey), away from its ends. If `swept`, it's the
 * edge from s·(ux, uy) along s·(ex, ey) that comes within `margin` of
 * (ax, ay) instead.
 */
function touch(
    ux: number,
    uy: number,
    ax: number,
    ay: number,
    ex: number,
    ey: number,
    margin: number,
    swept?: boolean
) {
    const across = ex * ay - ey * ax
    const length = hypot(ex, ey)
    const s =
        Math.abs(across) > margin * length
            ? (across - Math.sign(across) * margin * length) /
              (ex * uy - ey * ux)
            : swept
            ? -1
            : 0
    const along = ((s * ux - ax) * ex + (s * uy - ay) * ey) / length ** 2
    return s >= 0 &&
        (swept ? along <= 0 && along >= -s : along >= 0 && along <= 1)
        ? s
        : Infinity
}

/**
 * Keep the points of a hole `margin` inside its outline, and the corners
 * of the outline `margin` outside the hole, moving the hole either way.
 * Returns the closest they came to each other.
 */
export const fit = (hole: Points, outer: Points, margin: number) =>
    Math.min(push(hole, outer, margin, false), push(outer, hole, margin, true))

/**
 * Move each point of `from` that's outside `polygon`, or less than
 * `margin` inside it, to `margin` inside its nearest edge. If `out` is
 * set, keep them outside instead, by moving the edge. Returns how close
 * the closest point comes to the edges.
 */
function push(from: Points, polygon: Points, margin: number, out: boolean) {
    const n = polygon.length
    const sign = Math.sign(contour(polygon, true).area) * (out ? -1 : 1)
    let least = Infinity
    for (let i = 0; i < from.length; i += 2) {
        const x = from[i]
        const y = from[i + 1]
        const [distance, edge, px, py] = nearest(x, y, polygon)
        least = Math.min(least, distance)
        if (isInside(x, y, polygon) !== out && distance >= margin) continue

        const next = (edge + 2) % n
        const dx = polygon[next] - polygon[edge]
        const dy = polygon[next + 1] - polygon[edge + 1]
        const length = hypot(dx, dy) || 1
        const ox = px - (dy / length) * sign * margin - x
        const oy = py + (dx / length) * sign * margin - y
        if (out) {
            polygon[edge] -= ox
            polygon[edge + 1] -= oy
            polygon[next] -= ox
            polygon[next + 1] -= oy
        } else {
            from[i] += ox
            from[i + 1] += oy
        }
    }
    return least
}

/**
 * How far (x, y) is from the edges of a polygon, and the edge and the
 * point on it that are closest.
 */
function nearest(x: number, y: number, polygon: Points) {
    let least = [Infinity, 0, x, y]
    for (let j = 0; j < polygon.length; j += 2) {
        const [px, py] = closest(x, y, polygon, j)
        const distance = hypot(px - x, py - y)
        if (distance < least[0]) least = [distance, j, px, py]
    }
    return least
}

/**
 * The closest point to (x, y) on the edge of a polygon that starts at
 * index `j`.
 */
function closest(x: number, y: number, polygon: Points, j: number) {
    const n = polygon.length
    const x0 = polygon[j]
    const y0 = polygon[j + 1]
    const dx = polygon[(j + 2) % n] - x0
    const dy = polygon[(j + 3) % n] - y0
    const t = Math.max(
        0,
        Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1))
    )
    return [x0 + t * dx, y0 + t * dy]
}
