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
 * Whether `p` is within the area `rings` enclose, by the nonzero fill
 * rule (SVG's default) or, if `evenOdd`, the even-odd rule.
 */
function isInside(rings: Ring[], { x, y }: Point, evenOdd?: boolean) {
    let winding = 0

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
                winding += by > ay ? 1 : -1
            }
        }
    }

    return !!(evenOdd ? winding % 2 : winding)
}

/**
 * Whether the contact's segment is an edge of the area, rather than a line
 * with the area on both sides, where subpaths overlap.
 */
function isEdge(
    rings: Ring[],
    { r, i, x, y }: Contact,
    inside: (p: Point) => boolean
) {
    const { points } = rings[r]
    const dx = points[i * 2 + 2] - points[i * 2]
    const dy = points[i * 2 + 3] - points[i * 2 + 1]
    // A hair either side of it
    const length = Math.hypot(dx, dy) * 1e4

    return (
        !inside({ x: x + dy / length, y: y - dx / length }) ||
        !inside({ x: x - dy / length, y: y + dx / length })
    )
}

/**
 * The first point at which the segment from `a` to `b` crosses an edge.
 * Starting on an edge isn't crossing it, so a point resting on an edge
 * can leave it.
 */
function cross(
    rings: Ring[],
    a: Point,
    b: Point,
    inside: (p: Point) => boolean
) {
    const ex = b.x - a.x
    const ey = b.y - a.y
    let from = 1e-9

    while (true) {
        let hit: Contact | undefined
        let min = 1

        rings.forEach(({ points }, r) => {
            for (let i = 0; i < points.length - 2; i += 2) {
                const ax = points[i] - a.x
                const ay = points[i + 1] - a.y
                const dx = points[i + 2] - points[i]
                const dy = points[i + 3] - points[i + 1]
                const denominator = ex * dy - ey * dx
                const s = (ax * dy - ay * dx) / denominator
                const t = (ax * ey - ay * ex) / denominator

                if (s > from && s <= min && t >= 0 && t <= 1) {
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

        // Look past any line within the area for the edge beyond
        if (!hit || isEdge(rings, hit, inside)) return hit
        from = min
    }
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
 *
 * Its `reach()` limits how far toward a point the point can be drawn (by
 * elastic): halfway to the next edge or line in the way, so it's never
 * nearer one beyond than the one it rests on.
 */
export function createPathSolver(
    rings: Ring[],
    start: Point,
    stroke: boolean,
    forgiveness: number,
    evenOdd?: boolean
) {
    let current = start
    let contact: Contact | undefined

    const inside = (p: Point) => !stroke && isInside(rings, p, evenOdd)
    const halfway = (hit?: Point) =>
        hit && { x: (current.x + hit.x) / 2, y: (current.y + hit.y) / 2 }

    const solve = (target: Point, lookahead = forgiveness): Point => {
        if (!rings.length) return current

        const hit = cross(rings, current, target, inside)
        if (inside(target) && !hit) {
            contact = undefined
            return (current = target)
        }

        /**
         * Rest against the first edge in the way. Unless this is resting on
         * an edge and heading out of the area: then any edge beyond is on
         * the far side of a wall, so keep sliding on this one.
         */
        const mid = halfway(hit)
        if (mid && inside(mid)) contact = hit

        contact = slide(
            rings,
            contact || nearest(rings, current),
            target,
            lookahead
        )
        current = { x: contact.x, y: contact.y }

        /**
         * A slide can run on into another subpath's area. If it stops
         * there, carry on to the edge of that area.
         */
        for (
            let k = 0;
            k < rings.length && !isEdge(rings, contact, inside);
            k++
        ) {
            const next = cross(rings, current, target, inside)
            if (!next) break
            contact = slide(rings, next, target, lookahead)
            current = { x: contact.x, y: contact.y }
        }

        if (inside(target) && !cross(rings, current, target, inside)) {
            contact = undefined
            current = target
        }

        return current
    }

    solve.reach = (to: Point): Point =>
        halfway(cross(rings, current, to, inside)) || to

    return solve
}
