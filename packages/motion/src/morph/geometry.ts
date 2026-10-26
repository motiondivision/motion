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
}

export const hypot = Math.hypot

/**
 * Flatten cubics into a polyline whose distance from the curve stays
 * under `tolerance`, then split edges longer than 1/`detail` of the
 * perimeter. Short edges and corners are kept as they are, so features
 * survive and long sides get enough points to match against.
 */
export function flatten(
    { segments, closed }: Subpath,
    tolerance: number,
    detail: number
): Points {
    const points: Points = []
    const add = (px: number, py: number) => {
        const n = points.length
        if (!n || px !== points[n - 2] || py !== points[n - 1]) {
            points.push(px, py)
        }
    }

    add(segments[0][0], segments[0][1])
    for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segments) {
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
            add(
                a * x0 + b * x1 + c * x2 + e * x3,
                a * y0 + b * y1 + c * y2 + e * y3
            )
        }
    }

    const n = points.length
    if (
        closed &&
        n > 2 &&
        points[0] === points[n - 2] &&
        points[1] === points[n - 1]
    ) {
        points.length -= 2
    }

    const maxLength = perimeter(points, closed) / detail
    if (!maxLength) return points

    const split: Points = []
    const count = points.length / 2
    for (let i = 0; i < count; i++) {
        const x = points[2 * i]
        const y = points[2 * i + 1]
        split.push(x, y)
        if (i < count - 1 || closed) {
            const j = (2 * i + 2) % points.length
            const dx = points[j] - x
            const dy = points[j + 1] - y
            const pieces = Math.ceil(hypot(dx, dy) / maxLength)
            for (let k = 1; k < pieces; k++) {
                split.push(x + (dx * k) / pieces, y + (dy * k) / pieces)
            }
        }
    }
    return split
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

export function contour(points: Points, closed: boolean): Contour {
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
    }
}

export function reverse(points: Points): Points {
    const reversed: Points = []
    for (let i = points.length - 2; i >= 0; i -= 2) {
        reversed.push(points[i], points[i + 1])
    }
    return reversed
}

function isInside(x: number, y: number, points: Points) {
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
        // tan(angle / 2) = cross / (|a||b| + dot), stable for coincident points
        halfTan[i] =
            (ax * by - ay * bx) /
            (hypot(ax, ay) * hypot(bx, by) + ax * bx + ay * by || 1e-12)
    }

    for (let i = 0; i < n; i++) {
        const distance = hypot(points[2 * i] - x, points[2 * i + 1] - y)
        if (distance < 1e-9) {
            weights.fill(0)
            weights[i] = 1
            return weights
        }
        weights[i] = (halfTan[(i + n - 1) % n] + halfTan[i]) / distance
        sum += weights[i]
    }

    for (let i = 0; i < n; i++) weights[i] /= sum
    return weights
}

/**
 * A point inside a polygon that, if any can, sees all of it, so the
 * polygon can shrink towards it without leaving itself. (x, y) moves onto
 * the inside of each edge's line in turn, which settles where the insides
 * of every edge meet, if they do. A point that's left outside moves onto
 * the nearest edge.
 */
export function within(points: Points, x: number, y: number) {
    const n = points.length
    const sign = Math.sign(contour(points, true).area)
    for (let pass = 0; pass < 20; pass++) {
        for (let i = 0; i < n; i += 2) {
            const x0 = points[i]
            const y0 = points[i + 1]
            const dx = points[(i + 2) % n] - x0
            const dy = points[(i + 3) % n] - y0
            const side =
                (dx * (y - y0) - dy * (x - x0)) / (dx * dx + dy * dy || 1)
            if (side * sign < 0) {
                x += side * dy
                y -= side * dx
            }
        }
    }
    const point = [x, y]
    push(point, points, 0, false)
    return point
}

/**
 * Keep `points` `margin` inside `outer`: points outside it, or too close
 * to its edge, move inside the edge nearest them, and corners of it that
 * poke in, or come too close, push the edge of `points` nearest them back.
 */
export function fit(points: Points, outer: Points, margin: number) {
    push(points, outer, margin, false)
    push(outer, points, margin, true)
}

/**
 * Move the points of `from` to `margin` inside `polygon` (or outside it,
 * if `move` is set), past its nearest edge. Moving the polygon's edge
 * instead, if `move` is set. Returns the squared distance of the closest
 * point to the polygon's edges.
 */
function push(from: Points, polygon: Points, margin: number, move: boolean) {
    const n = polygon.length
    let closest = Infinity
    const { area, x: cx, y: cy, size } = contour(polygon, true)
    const sign = Math.sign(area) * (move ? -1 : 1)
    for (let i = 0; i < from.length; i += 2) {
        const x = from[i]
        const y = from[i + 1]
        // Points well clear of the polygon can't be inside it, or near it
        if (move && hypot(x - cx, y - cy) > size + margin) continue
        let nearest = Infinity
        let edge = 0
        for (let j = 0; j < n; j += 2) {
            const distance = segmentDistance(
                x,
                y,
                polygon[j],
                polygon[j + 1],
                polygon[(j + 2) % n],
                polygon[(j + 3) % n]
            )
            if (distance < nearest) {
                nearest = distance
                edge = j
            }
        }
        closest = Math.min(closest, nearest)
        // On the right side, and far enough from the edge
        if (isInside(x, y, polygon) !== move && nearest >= margin * margin) {
            continue
        }

        // Move to `margin` the right side of the edge
        const next = (edge + 2) % n
        const x0 = polygon[edge]
        const y0 = polygon[edge + 1]
        const dx = polygon[next] - x0
        const dy = polygon[next + 1] - y0
        const length = hypot(dx, dy) || 1
        const along = Math.max(
            0,
            Math.min(1, ((x - x0) * dx + (y - y0) * dy) / length ** 2)
        )
        const ox = x0 + along * dx - (dy / length) * sign * margin - x
        const oy = y0 + along * dy + (dx / length) * sign * margin - y
        if (move) {
            polygon[edge] -= ox
            polygon[edge + 1] -= oy
            polygon[next] -= ox
            polygon[next + 1] -= oy
        } else {
            from[i] += ox
            from[i + 1] += oy
        }
    }
    return closest
}

/**
 * The closest any of `points` come to the edges of `outer`.
 */
export const gap = (points: Points, outer: Points) =>
    Math.sqrt(push(points.slice(), outer, 0, false))

/**
 * The squared distance from (x, y) to the segment from (x0, y0) to (x1, y1).
 */
function segmentDistance(
    x: number,
    y: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number
) {
    const dx = x1 - x0
    const dy = y1 - y0
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared
        ? Math.max(
              0,
              Math.min(1, ((x - x0) * dx + (y - y0) * dy) / lengthSquared)
          )
        : 0
    return (x - x0 - t * dx) ** 2 + (y - y0 - t * dy) ** 2
}
