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
    if (closed && n > 2 && points[0] === points[n - 2] && points[1] === points[n - 1]) {
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
            x <
                ((points[j] - points[i]) * (y - yi)) / (yj - yi) + points[i]
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
            if (candidate.closed && child.closed && encloses(candidate, child)) {
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
            (ax * by - ay * bx) / (hypot(ax, ay) * hypot(bx, by) + ax * bx + ay * by || 1e-12)
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
 * Shrink `points` about (cx, cy) until they sit clear of `outer`, so a hole
 * or island never touches the contour around it.
 */
export function keepInside(
    points: Points,
    cx: number,
    cy: number,
    outer: Points
) {
    let radius = 0
    for (let i = 0; i < points.length; i += 2) {
        radius = Math.max(radius, hypot(points[i] - cx, points[i + 1] - cy))
    }

    const n = outer.length
    let clearance = Infinity
    for (let i = 0; i < n; i += 2) {
        clearance = Math.min(
            clearance,
            segmentDistance(cx, cy, outer[i], outer[i + 1], outer[(i + 2) % n], outer[(i + 3) % n])
        )
    }

    // Every point is closer than any edge, with room to spare
    if (radius <= MARGIN * clearance) return

    // How far along the ray from the centre to each point the outline is
    let reach = isInside(cx, cy, outer) ? Infinity : 0
    for (let i = 0; i < points.length && reach; i += 2) {
        const dx = points[i] - cx
        const dy = points[i + 1] - cy
        for (let j = 0; j < n; j += 2) {
            const px = outer[j] - cx
            const py = outer[j + 1] - cy
            const ex = outer[(j + 2) % n] - outer[j]
            const ey = outer[(j + 3) % n] - outer[j + 1]
            const denominator = dx * ey - dy * ex
            if (!denominator) continue
            const along = (px * ey - py * ex) / denominator
            const across = (px * dy - py * dx) / denominator
            if (along > 0 && across >= 0 && across <= 1) {
                reach = Math.min(reach, along)
            }
        }
    }

    const scale = Math.min(1, MARGIN * reach)
    if (scale >= 1) return
    for (let i = 0; i < points.length; i += 2) {
        points[i] = cx + (points[i] - cx) * scale
        points[i + 1] = cy + (points[i + 1] - cy) * scale
    }
}

const MARGIN = 0.9

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
        ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / lengthSquared))
        : 0
    return hypot(x - x0 - t * dx, y - y0 - t * dy)
}
