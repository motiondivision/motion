import { blend } from "./morph/blend"
import { correspond, distances, merge } from "./morph/correspond"
import {
    CAGE,
    contact,
    contour,
    Contour,
    every,
    fit,
    flatten,
    hypot,
    isInside,
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
 * How much holes need to shrink is measured this many times through a
 * morph, and FINE times as often wherever it changes by more than JUMP
 * between two measures.
 */
const STEPS = 16
const FINE = 16
const JUMP = 0.1

/**
 * Holes shrink and grow no faster than this, as a share of their size
 * over the whole morph, unless they'd touch their outline between the
 * times it's measured.
 */
const SLOPE = 6

/**
 * Holes keep this share of how close they come to their outline at
 * either end, blended evenly through the morph, or as much of it as they
 * can while they shrink.
 */
const GAP = 0.5

interface Track {
    /**
     * Writes the contour at `t`, inside the drawn parent if it has one.
     * Returns nothing while the contour has shrunk away.
     */
    draw: (t: number, parent?: Points) => Points | undefined
    /**
     * The track this one is drawn inside, or moves along with, which is
     * drawn before it. -1 for none.
     */
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
 * partner shrink into the nearest piece, or grow out of it, and holes
 * without one shrink to a point or grow from one. Each part of an open
 * path moves straight to the same part of the other, as when a curve's
 * control points move. In-between shapes are written as polylines, and
 * the original strings are returned at 0 and 1, so an interrupted morph
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

        const hosts: [number, Points, Points][] = []
        as.forEach(
            (a, i) =>
                partners[i] &&
                hosts.push(pair(a, partners[i], parent, parentA, parentB))
        )

        /**
         * Pieces with no partner shrink into, or grow out of, the nearest
         * point of a piece that has one, and move along with it. So they
         * end or start on its line, where a stroke's caps leave no dot.
         * Holes shrink to a point inside them instead, to keep clear of
         * their outline.
         */
        const lone = (c: Contour, grow: boolean) => {
            let host = parent
            let spot = 0
            let nearest = Infinity
            for (const [index, ...ends] of parentA ? [] : hosts) {
                // Nearest at the end the piece is drawn at
                const points = ends[+grow]
                for (let i = 0; i < points.length; i += 2) {
                    const d = hypot(points[i] - c.x, points[i + 1] - c.y)
                    if (d < nearest) {
                        nearest = d
                        host = index
                        spot = i
                    }
                }
            }
            single(c, grow, host, grow ? parentB : parentA, flip, false, spot)
        }
        as.forEach((a, i) => partners[i] || lone(a, false))
        bs.forEach((b, j) => taken[j] || lone(b, true))
    }

    const pair = (
        a: Contour,
        b: Contour,
        parent: number,
        parentA?: Points,
        parentB?: Points
    ): [number, Points, Points] => {
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

        const index = tracks.length
        const mix: Mix = parentA
            ? hold(
                  sit(ea, parentA, a.x, a.y),
                  sit(eb, parentB!, b.x, b.y),
                  (t) => shape(parent, t)
              )
            : blend(ea, eb, linear || !closed)
        const out: Points = []

        tracks.push({
            parent,
            closed,
            draw: (t, outer) => (mix(t, out, outer!) !== 0 ? out : undefined),
        })

        match(a.children, b.children, index, ea, eb, flip)
        return [index, ea, eb]
    }

    /**
     * A contour with no partner shrinks away to a point, or grows from
     * one. A hole's point is inside it, among its parent's points. Other
     * pieces use the point at `spot` in the track they move with. Anything
     * inside a contour keeps its place in it, so shrinks and grows along
     * with it.
     */
    const single = (
        c: Contour,
        grow: boolean,
        parent: number,
        parentPoints?: Points,
        flip = 1,
        follow?: boolean,
        spot = 0
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
                [follow ? seat[0] : [seat[1]], seat[1], 0, seat[3]],
                seat,
                (s) => shape(parent, grow ? s : 1 - s)
            )
        const out: Points = []
        const index = tracks.length

        tracks.push({
            parent,
            closed,
            draw: (t, outer) => {
                const scale = grow ? t : 1 - t
                if (
                    scale > 0 &&
                    (mix
                        ? mix(scale, out, outer!)
                        : (toward(
                              out,
                              points,
                              outer![spot],
                              outer![spot + 1],
                              scale
                          ),
                          1))
                ) {
                    return out
                }
            },
        })

        for (const child of children) {
            single(child, grow, index, points, flip, true)
        }
    }

    /**
     * Draw track `i` at `t`, inside the tracks it's in, for holes to plan
     * how much they'll need to shrink.
     */
    const shape = (i: number, t: number): Points | undefined => {
        const { draw, parent } = tracks[i]
        // Tracks with no parent ignore `outer`
        const outer = parent < 0 || shape(parent, t)
        return outer && draw(t, outer as Points)
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
 * Writes a contour at `t` into `out`, inside `outer` if it has a parent.
 * Holes return the scale they're drawn at to stay inside it: 0 once
 * they've gone.
 */
type Mix = (t: number, out: Points, outer: Points) => number | void

/**
 * Where a contour sits in its parent: how each of its points sits among
 * the parent's, how a point inside it does, the gap it keeps from the
 * parent's outline, and whether it can't shrink towards that point
 * without touching the outline, like a U inside a U. The gap is GAP of
 * how close it comes to the outline. A hole that can shrink keeps as much
 * of that as it can while it shrinks, and one that can't is pushed to
 * keep all of it.
 */
type Seat = [Float64Array[], Float64Array, number, boolean]

/**
 * At most CAGE of a polygon's points, evenly spread.
 */
const cage = (points: Points) => every(points, CAGE)[0]

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
    const keep = fit(points.slice(), parent, 0) * GAP
    let gap = keep
    ;[x, y] = within(points, x, y)
    const fits = (margin: number) =>
        contact(points, parent, x, y, margin, 1) > 0.999

    // The most of that it can keep while it shrinks towards (x, y)
    if (!fits(gap)) {
        let low = 0
        for (let k = 0; k < 8; k++) {
            fits((low + gap) / 2)
                ? (low = (low + gap) / 2)
                : (gap = (low + gap) / 2)
        }
        gap = low
    }
    const band = !fits(gap)
    return [
        weigh(points, polygon),
        meanValue(x, y, polygon),
        band ? keep : gap,
        band,
    ]
}

/**
 * Holes are drawn among the points of their parent, each point blending
 * how it sits among them at either end, so they bend and stretch with
 * it. A single point's weights in `from` blend into every point's. A
 * parent that changes shape a lot can still pinch them, so then they
 * shrink towards a point that sees all of them, to keep an even blend of
 * the gaps they keep at either end. They're gone while that point is
 * outside the outline. How much they shrink is planned ahead from
 * `parentAt`, which draws the parent at any `t`, so they start to shrink
 * in time, as when part of them nears a corner of the outline, rather
 * than suddenly. Holes that can't shrink that way, like a U inside a U,
 * are pushed point by point to keep their gap instead.
 */
function hold(
    [weightsA, middleA, gapA, bandA]: Seat,
    [weightsB, middleB, gapB, bandB]: Seat,
    parentAt: (t: number) => Points | undefined
): Mix {
    const band = bandA || bandB
    const mix = (t: number, out: Points, outer: Points, most: number) => {
        const polygon = cage(outer)
        const margin = gapA + (gapB - gapA) * t
        weightsB.forEach((weights, i) => {
            ;[out[2 * i], out[2 * i + 1]] = anchor(
                t,
                weightsA[i] || weightsA[0],
                weights,
                polygon
            )
        })
        if (band) return fit(out, outer, margin), 1
        const [x, y] = anchor(t, middleA, middleB, polygon)
        const scale = isInside(x, y, outer)
            ? contact(out, outer, x, y, margin, most)
            : 0
        toward(out, out, x, y, scale)
        return scale
    }

    /**
     * The most the hole is scaled by at STEPS * FINE + 1 times through the
     * morph: at most what it needs then, and changing by no more than
     * SLOPE over the morph. It's measured every FINE of those times, and
     * at each of them in between wherever it changes by more than JUMP.
     */
    const plan: number[] = []
    const last = STEPS * FINE
    const measure = (k: number) => {
        const outer = !band && parentAt(k / last)
        return outer ? mix(k / last, [], outer, 1) : +band
    }
    for (let k = 0; k <= last; k += FINE) plan[k] = measure(k)
    for (let k = 0; k < last; k += FINE) {
        const change = plan[k + FINE] - plan[k]
        for (let j = 1; j < FINE; j++) {
            plan[k + j] =
                Math.abs(change) > JUMP
                    ? measure(k + j)
                    : plan[k] + (change * j) / FINE
        }
    }
    for (let k = 1; k <= last; k++) {
        plan[k] = Math.min(plan[k], plan[k - 1] + SLOPE / last)
    }
    for (let k = last; k--; ) {
        plan[k] = Math.min(plan[k], plan[k + 1] + SLOPE / last)
    }

    return (t, out, outer) => {
        // Past either end, as when a spring overshoots, holes keep their end
        // shape and gap, among the points of their overshooting parent
        const u = (t = Math.max(0, Math.min(1, t))) * last
        const k = Math.min(last - 1, u | 0)
        return mix(t, out, outer, plan[k] + (plan[k + 1] - plan[k]) * (u - k))
    }
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
