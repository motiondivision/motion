import { blend } from "./morph/blend"
import { correspond } from "./morph/correspond"
import {
    contour,
    Contour,
    fit,
    flatten,
    gap,
    hypot,
    meanValue,
    nest,
    Points,
    reverse,
    within,
} from "./morph/geometry"
import { parsePath, Subpath } from "./morph/parse"

export interface MorphOptions {
    /**
     * Move every point in a straight line, rather than blending the
     * lengths and angles of the outline's edges.
     */
    linear?: boolean
}

/**
 * Curves are flattened to within this share of the shapes' size.
 */
const TOLERANCE = 0.001

/**
 * Long edges are split until each is at most this share of the outline.
 */
const DETAIL = 40

interface Track {
    /**
     * Writes the contour at `t`, inside the drawn parent if it has one.
     * Returns nothing while the contour has shrunk away.
     */
    draw: (t: number, parent?: Points) => Points | undefined
    parent: number
    closed: boolean
}

/**
 * Create a mixer that morphs one SVG path into another. Pass it as a
 * transition's `mixer` to animate `d`:
 *
 * ```ts
 * animate(path, { d: to }, { mixer: morph })
 * ```
 *
 * Holes and separate pieces are matched by proximity. Pieces without a
 * partner shrink away or grow from a point. In-between shapes are written
 * as polylines, and the original strings are returned at 0 and 1, so an
 * interrupted morph carries on from wherever it was.
 *
 * Returns `undefined` unless both values start with a moveto, which
 * leaves other values in the same transition to Motion's usual mixing.
 */
export function morph(from: string, to: string, options?: MorphOptions) {
    let draw: ((t: number) => string) | undefined

    return isPath(from) && isPath(to)
        ? (p: number) =>
              !p
                  ? from
                  : p === 1 || from === to
                  ? to
                  : (draw ||= prepare(from, to, options))(p)
        : undefined
}

const isPath = (value: string) => /^\s*m(?![a-z])/i.test(value)

function prepare(from: string, to: string, { linear }: MorphOptions = {}) {
    const a = parsePath(from)
    const b = parsePath(to)
    if (!a.length || !b.length) return (t: number) => (t > 0 ? to : from)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const { segments } of a.concat(b)) {
        for (const segment of segments) {
            for (let i = 0; i < 8; i += 2) {
                minX = Math.min(minX, segment[i])
                minY = Math.min(minY, segment[i + 1])
                maxX = Math.max(maxX, segment[i])
                maxY = Math.max(maxY, segment[i + 1])
            }
        }
    }
    const size = hypot(maxX - minX, maxY - minY) || 1
    const precision = 10 ** Math.max(0, Math.round(Math.log10(5000 / size)))
    const shapes = (subpaths: Subpath[]) =>
        nest(
            subpaths.map((subpath) =>
                contour(
                    flatten(subpath, size * TOLERANCE, DETAIL),
                    subpath.closed
                )
            )
        )

    const tracks: Track[] = []

    /**
     * Pair up contours by distance, closest first. Children are compared
     * by where they sit relative to their parents, so holes stay matched
     * as their shapes move and change.
     */
    const match = (
        as: Contour[],
        bs: Contour[],
        parent = -1,
        parentA?: Points,
        parentB?: Points,
        flip = 1
    ) => {
        const candidates: number[][] = []
        as.forEach(({ x, y }, i) => {
            if (parentA) {
                const weights = meanValue(x, y, parentA)
                ;[x, y] = anchor(0, weights, weights, parentB!)
            }
            bs.forEach((b, j) =>
                candidates.push([hypot(b.x - x, b.y - y), i, j])
            )
        })
        candidates.sort((p, q) => p[0] - q[0])

        const partners: Contour[] = []
        const taken: boolean[] = []
        for (const [, i, j] of candidates) {
            if (!partners[i] && !taken[j]) {
                partners[i] = bs[j]
                taken[j] = true
            }
        }

        as.forEach((a, i) =>
            partners[i]
                ? pair(a, partners[i], parent, parentA, parentB)
                : single(a, false, parent, parentA)
        )
        bs.forEach((b, j) => taken[j] || single(b, true, parent, parentB, flip))
    }

    const pair = (
        a: Contour,
        b: Contour,
        parent: number,
        parentA?: Points,
        parentB?: Points
    ) => {
        const closed = a.closed && b.closed
        let pa = a.points
        let pb = b.points

        /**
         * The first shape's contours keep their winding, and the second's
         * turn to match, so in-between shapes fill like the first with
         * either fill rule.
         */
        const flip = a.area * b.area < 0 ? -1 : 1
        if (closed) {
            if (flip < 0) pb = reverse(pb)
        } else {
            // A closed outline paired with an open one opens into a loop
            if (a.closed) pa = loop(pa, pb)
            if (b.closed) pb = loop(pb, pa)
            // Run both the same way, so the ends don't swap places
            const reversed = reverse(pb)
            if (ends(pa, reversed) < ends(pa, pb)) pb = reversed
        }

        /**
         * Holes are matched where they'd sit in the second shape's parent,
         * so each point keeps to the same part of its parent throughout.
         */
        const [ea, eb] = correspond(
            parentA
                ? cage(pa, parentA).flatMap((w) => anchor(0, w, w, parentB!))
                : pa,
            pb,
            closed,
            1 / (Math.max(a.size, b.size) || 1),
            pa
        )

        /**
         * Holes are drawn among the points of their parent, each point
         * blending how it sits among them at either end. So holes bend
         * and stretch with their parent, and keep their distance from its
         * sides.
         */
        const weightsA = parentA && cage(ea, parentA)
        const weightsB = parentB && cage(eb, parentB)
        const gapA = parentA && gap(ea, parentA)
        const gapB = parentB && gap(eb, parentB)
        const mix = !parentA && blend(ea, eb, closed, linear)
        const out: Points = []
        const index = tracks.length

        tracks.push({
            parent,
            closed,
            draw: (t, outer) => {
                if (mix) mix(t, out)
                else {
                    const margin = (gapA! + (gapB! - gapA!) * t) / 2
                    place(out, t, weightsA!, weightsB!, outer!, margin)
                }
                return out
            },
        })

        match(a.children, b.children, index, ea, eb, flip)
    }

    /**
     * A contour with no partner shrinks away to a point, or grows from
     * one, along with anything inside it.
     */
    const single = (
        c: Contour,
        grow: boolean,
        parent: number,
        parentPoints?: Points,
        flip = 1
    ) => {
        let { points, closed, x, y, children } = c
        // The second shape's contours turn with the contour around them
        if (grow && flip < 0) points = reverse(points)

        // Holes shrink to a point inside them, so they stay inside too
        if (parentPoints) [x, y] = within(points, x, y)
        const weights = parentPoints && cage(points, parentPoints)
        const middle = parentPoints && [meanValue(x, y, parentPoints)]
        const clearance = parentPoints && gap(points, parentPoints) / 2
        const out: Points = []
        const index = tracks.length

        tracks.push({
            parent,
            closed,
            draw: (t, outer) => {
                const scale = grow ? t : 1 - t
                if (scale <= 0) return
                if (outer) {
                    place(out, scale, middle!, weights!, outer, clearance!)
                } else {
                    for (let i = 0; i < points.length; i += 2) {
                        out[i] = x + (points[i] - x) * scale
                        out[i + 1] = y + (points[i + 1] - y) * scale
                    }
                }
                return out
            },
        })

        match(
            grow ? [] : children,
            grow ? children : [],
            index,
            points,
            points,
            flip
        )
    }

    /**
     * New pieces turn with the second shape, if its outline winds the
     * other way to the first's.
     */
    const rootsA = shapes(a)
    const rootsB = shapes(b)
    match(
        rootsA,
        rootsB,
        -1,
        undefined,
        undefined,
        rootsA[0].area * rootsB[0].area < 0 ? -1 : 1
    )

    return (t: number) => {
        const drawn: (Points | undefined)[] = []
        let d = ""
        for (const { draw, parent, closed } of tracks) {
            const outer = drawn[parent]
            const points = parent < 0 || outer ? draw(t, outer) : undefined
            drawn.push(points)
            if (points) {
                d +=
                    "M" +
                    points
                        .map((v) => Math.round(v * precision) / precision)
                        .join(" ") +
                    (closed ? "Z" : "")
            }
        }
        return d
    }
}

/**
 * The point that blended weights pick out of a polygon.
 */
function anchor(
    t: number,
    weightsA: ArrayLike<number>,
    weightsB: ArrayLike<number>,
    points: Points
): [number, number] {
    let x = 0
    let y = 0
    for (let i = 0; i < weightsA.length; i++) {
        const weight = weightsA[i] + (weightsB[i] - weightsA[i]) * t
        x += weight * points[2 * i]
        y += weight * points[2 * i + 1]
    }
    return [x, y]
}

/**
 * Mean value coordinates of each point with respect to a polygon.
 */
const cage = (points: Points, polygon: Points) => {
    const weights: Float64Array[] = []
    for (let i = 0; i < points.length; i += 2) {
        weights.push(meanValue(points[i], points[i + 1], polygon))
    }
    return weights
}

/**
 * Write the points that blended weights pick out of a polygon into
 * `out`. A single set of weights `from` blends into every point's. A
 * polygon that changes shape a lot can still pinch them, so they're kept
 * `margin` inside it too.
 */
function place(
    out: Points,
    t: number,
    from: Float64Array[],
    to: Float64Array[],
    polygon: Points,
    margin: number
) {
    to.forEach((weights, i) => {
        ;[out[2 * i], out[2 * i + 1]] = anchor(
            t,
            from[i] || from[0],
            weights,
            polygon
        )
    })
    fit(out, polygon, margin)
}

/**
 * Open a closed outline into a loop that starts and ends at its point
 * nearest the start of `other`.
 */
function loop(points: Points, other: Points) {
    let start = 0
    let nearest = Infinity
    for (let i = 0; i < points.length; i += 2) {
        const distance = hypot(points[i] - other[0], points[i + 1] - other[1])
        if (distance < nearest) {
            nearest = distance
            start = i
        }
    }
    const opened = points.slice(start).concat(points.slice(0, start))
    opened.push(opened[0], opened[1])
    return opened
}

/**
 * How far apart the ends of two open polylines are.
 */
function ends(a: Points, b: Points) {
    const lastA = a.length - 2
    const lastB = b.length - 2
    return (
        hypot(a[0] - b[0], a[1] - b[1]) +
        hypot(a[lastA] - b[lastB], a[lastA + 1] - b[lastB + 1])
    )
}
