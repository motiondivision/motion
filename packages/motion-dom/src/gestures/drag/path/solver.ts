import { clamp, type Point } from "motion-utils"

/**
 * A polyline as flat `[x0, y0, x1, y1, ...]` points, with the arc length
 * at each point. A closed ring's last point repeats its first.
 */
export interface Ring {
    points: number[]
    lengths: number[]
    closed: boolean
}

/**
 * A point on a ring: on segment `i` (from point `i` to `i + 1`), `t` of
 * the way along it, `d` from the point it was found for.
 */
interface Contact extends Point {
    r: number
    i: number
    t: number
    d: number
}

export function createRing(points: number[], closed: boolean): Ring {
    const n = points.length
    if (
        closed &&
        (points[0] !== points[n - 2] || points[1] !== points[n - 1])
    ) {
        points.push(points[0], points[1])
    }

    const lengths = [0]
    for (let i = 2; i < points.length; i += 2) {
        lengths.push(
            lengths[i / 2 - 1] +
                Math.hypot(
                    points[i] - points[i - 2],
                    points[i + 1] - points[i - 1]
                )
        )
    }

    return { points, lengths, closed }
}

function project(rings: Ring[], r: number, i: number, p: Point): Contact {
    const { points } = rings[r]
    const ax = points[i * 2]
    const ay = points[i * 2 + 1]
    const dx = points[i * 2 + 2] - ax
    const dy = points[i * 2 + 3] - ay
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq
        ? clamp(0, 1, ((p.x - ax) * dx + (p.y - ay) * dy) / lengthSq)
        : 0
    const x = ax + t * dx
    const y = ay + t * dy

    return { r, i, t, x, y, d: Math.hypot(p.x - x, p.y - y) }
}

/**
 * Slide from `from` along its ring in direction `dir`, to the point nearest
 * `p`. The slide goes downhill (nearer to `p`), and is forgiven going
 * uphill for up to `lookahead` px, so it can round a corner to a nearer
 * point beyond it. It never leaves the ring, so it can't jump a gap.
 */
function walk(
    rings: Ring[],
    from: Contact,
    p: Point,
    dir: number,
    lookahead: number
) {
    const { r } = from
    const { points, lengths, closed } = rings[r]
    const segments = lengths.length - 1
    let { i } = from
    let best = project(rings, r, i, p)
    let length = lengths[i + 1] - lengths[i]
    let bestArc = length * Math.max(0, (best.t - from.t) * dir)
    let arc = length * (dir > 0 ? 1 - from.t : from.t)

    for (let k = 1; k < segments && arc - bestArc <= lookahead; k++) {
        i += dir
        if (i < 0 || i >= segments) {
            if (!closed) break
            i = (i + segments) % segments
        }

        const contact = project(rings, r, i, p)
        length = lengths[i + 1] - lengths[i]

        if (contact.d < best.d) {
            /**
             * The slide reaches this segment's first point nearer than
             * `best` this far along it. Past the lookahead, stop.
             */
            const j = (dir > 0 ? i : i + 1) * 2
            const ex = p.x - points[j]
            const ey = p.y - points[j + 1]
            const h =
                ((ex * (points[i * 2 + 2] - points[i * 2]) +
                    ey * (points[i * 2 + 3] - points[i * 2 + 1])) *
                    dir) /
                length
            const nearer =
                h - Math.sqrt(h * h - ex * ex - ey * ey + best.d ** 2)

            if (arc + Math.max(0, nearer) - bestArc > lookahead) break

            best = contact
            bestArc = arc + length * (dir > 0 ? contact.t : 1 - contact.t)
        }
        arc += length
    }

    return best
}

function slide(rings: Ring[], from: Contact, p: Point, lookahead: number) {
    const forward = walk(rings, from, p, 1, lookahead)
    const back = walk(rings, from, p, -1, lookahead)
    return forward.d <= back.d ? forward : back
}

function nearest(rings: Ring[], p: Point) {
    let best: Contact | undefined
    rings.forEach((_, r) => {
        const contact = walk(
            rings,
            { r, i: 0, t: 0 } as Contact,
            p,
            1,
            Infinity
        )
        if (!best || contact.d < best.d) best = contact
    })
    return best!
}

/**
 * The first point at which the segment from `a` to `b` crosses an edge.
 * Starting on an edge isn't crossing it, so a point resting on an edge
 * can leave it.
 */
function cross(rings: Ring[], a: Point, b: Point) {
    let hit: Contact | undefined
    let min = 1
    const ex = b.x - a.x
    const ey = b.y - a.y

    rings.forEach(({ points }, r) => {
        for (let i = 0; i < points.length - 2; i += 2) {
            const ax = points[i] - a.x
            const ay = points[i + 1] - a.y
            const dx = points[i + 2] - points[i]
            const dy = points[i + 3] - points[i + 1]
            const denominator = ex * dy - ey * dx
            const s = (ax * dy - ay * dx) / denominator
            const t = (ax * ey - ay * ex) / denominator

            if (s > 1e-9 && s <= min && t >= 0 && t <= 1) {
                min = s
                hit = {
                    r,
                    i: i / 2,
                    t,
                    x: a.x + ex * s,
                    y: a.y + ey * s,
                    d: 0,
                }
            }
        }
    })

    return hit
}

/**
 * Even-odd, so a ring inside another is a hole.
 */
function isInside(rings: Ring[], { x, y }: Point) {
    let inside = false

    for (const { points } of rings) {
        for (let i = 0; i < points.length - 2; i += 2) {
            const ax = points[i]
            const ay = points[i + 1]
            const bx = points[i + 2]
            const by = points[i + 3]

            if (
                ay > y !== by > y &&
                x < ax + ((y - ay) * (bx - ax)) / (by - ay)
            ) {
                inside = !inside
            }
        }
    }

    return inside
}

/**
 * Returns a function that moves a point toward each target it's given,
 * within the area `rings` enclose, or along their lines if `stroke`.
 *
 * Within an area the point follows the target while it can see it. When
 * it can't, it rests against the edge it ran into, then slides along that
 * edge to the point nearest the target. It moves continuously, so it never
 * jumps a wall to reach the target, but it rounds a corner up to
 * `forgiveness` px away (or a `lookahead` given with the target) to reach
 * a point beyond it.
 */
export function createPathSolver(
    rings: Ring[],
    start: Point,
    stroke: boolean,
    forgiveness: number
) {
    let current = start
    let contact: Contact | undefined

    const isFree = (target: Point) =>
        !stroke && isInside(rings, target) && !cross(rings, current, target)

    return (target: Point, lookahead = forgiveness): Point => {
        if (isFree(target)) {
            contact = undefined
            return (current = target)
        }

        /**
         * Rest against the first edge in the way. Unless this is resting on
         * an edge and heading out of the area: then any edge beyond is on
         * the far side of a wall, so keep sliding on this one.
         */
        const hit = !stroke && cross(rings, current, target)
        if (
            hit &&
            isInside(rings, {
                x: (current.x + hit.x) / 2,
                y: (current.y + hit.y) / 2,
            })
        ) {
            contact = hit
        }

        contact = slide(
            rings,
            contact || nearest(rings, current),
            target,
            lookahead
        )
        current = { x: contact.x, y: contact.y }

        if (isFree(target)) {
            contact = undefined
            current = target
        }

        return current
    }
}
