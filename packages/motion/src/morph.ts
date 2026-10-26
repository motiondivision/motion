import { blend } from "./morph/blend"
import { correspond, distances, merge } from "./morph/correspond"
import {
    contour,
    Contour,
    fit,
    flatten,
    hypot,
    meanValue,
    nest,
    Points,
    reach,
    reverse,
    within,
} from "./morph/geometry"
import { parsePath, Subpath } from "./morph/parse"

export interface MorphOptions {
    /**
     * Move every point in a straight line, rather than blending the
     * lengths and angles of the outline's edges. Open paths always move
     * in straight lines.
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

/**
 * Holes are placed among at most this many of their outline's points.
 */
const CAGE = 64

/**
 * Holes can reach this share of the way to their outline from a point
 * inside them, or as far as they do at either end, before they shrink to
 * keep clear of it.
 */
const FILL = 0.9

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
 * partner shrink away or grow from a point. Each part of an open path
 * moves straight to the same part of the other, as when a curve's control
 * points move. In-between shapes are written as polylines, and the
 * original strings are returned at 0 and 1, so an interrupted morph
 * carries on from wherever it was.
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
            subpaths.map((subpath) => {
                const [points, along] = flatten(
                    subpath,
                    size * TOLERANCE,
                    DETAIL
                )
                return contour(points, subpath.closed, along)
            })
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
                const weights = meanValue(x, y, cage(parentA))
                ;[x, y] = anchor(0, weights, weights, cage(parentB!))
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
        let alongA = a.along
        let alongB = b.along

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
            if (a.closed) alongA = distances((pa = loop(pa, pb)), false)
            if (b.closed) alongB = distances((pb = loop(pb, pa)), false)
            // Run both the same way, so the ends don't swap places
            const reversed = reverse(pb)
            if (ends(pa, reversed) < ends(pa, pb)) {
                pb = reversed
                alongB = alongB.map((s) => 1 - s).reverse()
            }
        }

        /**
         * Holes are matched where they'd sit in the second shape's parent,
         * so each point keeps to the same part of its parent throughout.
         * Open paths move straight from each part to the same part of the
         * other, like the points of a curve whose control points move.
         */
        const [ea, eb] = closed
            ? correspond(
                  parentA
                      ? weigh(pa, cage(parentA)).flatMap((w) =>
                            anchor(0, w, w, cage(parentB!))
                        )
                      : pa,
                  pb,
                  1 / (Math.max(a.size, b.size) || 1),
                  pa
              )
            : merge(pa, alongA, pb, alongB)

        const mix: Mix = parentA
            ? hold(sit(ea, parentA, a.x, a.y), sit(eb, parentB!, b.x, b.y))
            : blend(ea, eb, linear || !closed)
        const out: Points = []
        const index = tracks.length

        tracks.push({
            parent,
            closed,
            draw: (t, outer) => (mix(t, out, outer!), out),
        })

        match(a.children, b.children, index, ea, eb, flip)
    }

    /**
     * A contour with no partner shrinks away to a point, or grows from
     * one. Anything inside it keeps its place in it, so shrinks and grows
     * along with it.
     */
    const single = (
        c: Contour,
        grow: boolean,
        parent: number,
        parentPoints?: Points,
        flip = 1,
        follow?: boolean
    ) => {
        let { points, closed, x, y, children } = c
        // The second shape's contours turn with the contour around them
        if (grow && flip < 0) points = reverse(points)

        /**
         * Holes grow from a point inside them, among the points of their
         * parent. Those in a piece that grows keep their place in it, and
         * their distance from its sides grows with it.
         */
        const seat = parentPoints && sit(points, parentPoints, x, y)
        const mix =
            seat &&
            hold(
                follow
                    ? [seat[0], seat[1], seat[2], 0]
                    : [[seat[1]], seat[1], 0, 0],
                seat
            )
        const out: Points = []
        const index = tracks.length

        tracks.push({
            parent,
            closed,
            draw: (t, outer) => {
                const scale = grow ? t : 1 - t
                if (scale <= 0) return
                mix ? mix(scale, out, outer!) : toward(out, points, x, y, scale)
                return out
            },
        })

        for (const child of children) {
            single(child, grow, index, points, flip, true)
        }
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

type Mix = (t: number, out: Points, outer: Points) => void

/**
 * Where a contour sits in its parent: how each of its points sits among
 * the parent's, how a point inside it does, how far it reaches towards
 * the parent's outline from there, and how close it comes to it. It
 * reaches past the outline if it can't shrink towards that point without
 * crossing it, like a U inside a U.
 */
type Seat = [Float64Array[], Float64Array, number, number]

/**
 * At most CAGE of a polygon's points, evenly spread.
 */
const cage = (points: Points) => {
    const step = 2 * Math.ceil(points.length / 2 / CAGE)
    return points.filter((_, i) => i % step < 2)
}

/**
 * Mean value coordinates of each point with respect to a polygon.
 */
const weigh = (points: Points, polygon: Points) => {
    const weights: Float64Array[] = []
    for (let i = 0; i < points.length; i += 2) {
        weights.push(meanValue(points[i], points[i + 1], polygon))
    }
    return weights
}

function sit(points: Points, parent: Points, x: number, y: number): Seat {
    const polygon = cage(parent)
    ;[x, y] = within(points, x, y)
    return [
        weigh(points, polygon),
        meanValue(x, y, polygon),
        reach(points, parent, x, y, FILL),
        fit(points.slice(), parent, 0),
    ]
}

/**
 * Holes are drawn among the points of their parent, each point blending
 * how it sits among them at either end, so they bend and stretch with
 * it. A single point's weights in `from` blend into every point's. A
 * parent that changes shape a lot can still pinch them. So then they
 * shrink towards a point inside them, to reach no further towards the
 * outline than they do at either end. Holes that can't shrink that way
 * are pushed to keep half as far from the outline as they do at either
 * end instead.
 */
const hold =
    (
        [weightsA, middleA, reachA, gapA]: Seat,
        [weightsB, middleB, reachB, gapB]: Seat
    ): Mix =>
    (t, out, outer) => {
        const polygon = cage(outer)
        weightsB.forEach((weights, i) => {
            ;[out[2 * i], out[2 * i + 1]] = anchor(
                t,
                weightsA[i] || weightsA[0],
                weights,
                polygon
            )
        })
        if (reachA > 1 || reachB > 1) {
            return fit(out, outer, (gapA + (gapB - gapA) * t) / 2)
        }
        const [x, y] = anchor(t, middleA, middleB, polygon)
        const most = Math.max(FILL, reachA + (reachB - reachA) * t)
        const scale = most / reach(out, outer, x, y, most)
        if (scale < 1) toward(out, out, x, y, scale)
    }

/**
 * Write `points`, scaled by `scale` towards (x, y), into `out`.
 */
function toward(
    out: Points,
    points: Points,
    x: number,
    y: number,
    scale: number
) {
    for (let i = 0; i < points.length; i++) {
        const centre = i % 2 ? y : x
        out[i] = centre + (points[i] - centre) * scale
    }
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
