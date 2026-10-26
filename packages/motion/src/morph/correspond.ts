import { hypot, perimeter, Points } from "./geometry"

/**
 * Work done per unit of each kind of change, relative to stretching an
 * edge, with both shapes scaled to the same size: moving the outline
 * (squared distance, per unit of length), bending a corner (radians) and
 * turning the whole shape (squared radians). Stretching stops edges
 * collapsing, bending lines corners up with corners, and moving keeps
 * each part of a shape where it was, so parts don't twist past each other
 * on the way.
 */
const MOVE = 15
const BEND = 0.15
const ROTATE = 0.25

/**
 * How much cheaper it is for a point to wait at a right-angled corner
 * while the other outline moves on, than on a straight stretch.
 */
const FAN = 0.9

/**
 * The cheapest correspondences stay within a quarter of the diagonal of
 * the grid of point pairs (Sederberg & Greenwood 1992, sec. 5.2), so the
 * search can skip the rest.
 */
const BAND = 0.25

/**
 * Pair up the points of two polylines so that blending between them takes
 * the least work, after Sederberg & Greenwood 1992.
 *
 * Returns both polylines with a point for every pair, so the same number
 * of points.
 */
export function correspond(
    a: Points,
    b: Points,
    closed: boolean,
    scale: number
): [Points, Points] {
    /**
     * The search takes time in proportion to the product of the outlines'
     * point counts, so it runs on just enough points to follow each one.
     */
    const keptA = thin(a, closed)
    const keptB = thin(b, closed)
    const pairs = search(pick(a, keptA), pick(b, keptB), closed, scale)
    return expand(
        a,
        b,
        pairs.map((index, k) => (k & 1 ? keptB : keptA)[index]),
        closed
    )
}

/**
 * Indices of the points that keep every corner of an outline, and follow
 * its curves to within TURN radians and its long sides to within SPACING
 * of its length. Outlines that wiggle a lot keep a point for every
 * 1/TURNS of their turning instead, so there are never too many.
 */
function thin(points: Points, closed: boolean) {
    const n = points.length / 2
    const lengths = edges(points, closed)
    const angles = turns(points, closed)
    const turn = Math.max(
        TURN,
        angles.reduce((total, angle) => total + Math.abs(angle), 0) / TURNS
    )
    const kept = [0]
    let travelled = 0
    let turned = 0
    for (let i = 1; i < n; i++) {
        travelled += lengths[i - 1]
        turned += Math.abs(angles[i])
        if (
            turned > turn ||
            travelled + lengths[i] > SPACING ||
            (!closed && i === n - 1)
        ) {
            kept.push(i)
            travelled = turned = 0
        }
    }
    return kept
}

const TURN = 0.25
const TURNS = 100
const SPACING = 1 / 40

function pick(points: Points, indices: number[]) {
    const picked: Points = []
    for (const i of indices) picked.push(points[2 * i], points[2 * i + 1])
    return picked
}

/**
 * The cheapest way through the grid of point pairs, as a list of pairs
 * [indexA, indexB, ...].
 */
function search(a: Points, b: Points, closed: boolean, scale: number) {
    const m = a.length / 2
    const n = b.length / 2
    let turnsA = turns(a, closed)
    const turnsB = turns(b, closed)

    // Start a at its sharpest corner, to try pairing it with b's
    let sharpest = 0
    if (closed) {
        turnsA.forEach((turn, i) => {
            if (Math.abs(turn) > Math.abs(turnsA[sharpest])) sharpest = i
        })
        a = a.slice(2 * sharpest).concat(a.slice(0, 2 * sharpest))
        turnsA = turns(a, closed)
    }
    const edgesA = edges(a, closed)
    const edgesB = edges(b, closed)

    // Distances are measured with both centres in the same place
    let ax = 0
    let ay = 0
    let bx = 0
    let by = 0
    for (let i = 0; i < 2 * m; i += 2) {
        ax += a[i] / m
        ay += a[i + 1] / m
    }
    for (let j = 0; j < 2 * n; j += 2) {
        bx += b[j] / n
        by += b[j + 1] / n
    }

    let best: number[] = []
    let bestWork = Infinity
    for (const offset of closed ? startPoints(a, b, turnsA[0], turnsB) : [0]) {
        /**
         * Paired from this start, b may fit a best turned round, as when
         * the shapes are the same but rotated. Distances are measured
         * after that turn, which costs a little of its own, so a shape can
         * turn as a whole but parts can't twist.
         */
        const angle = closed ? fit(a, b, offset, ax, ay, bx, by) : 0
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const fitted: number[] = []
        for (let j = 0; j < 2 * n; j += 2) {
            const x = b[j] - bx
            const y = b[j + 1] - by
            fitted.push(ax + cos * x - sin * y, ay + sin * x + cos * y)
        }

        const rows = closed ? m + 1 : m
        const columns = closed ? n + 1 : n
        const work = new Float64Array(rows * columns).fill(Infinity)
        const steps = new Uint8Array(rows * columns)
        // Wide enough for neighbouring rows to overlap, so there's a path
        const band = Math.max(BAND * columns, 3, columns / (rows - 1 || 1))
        const indexB = (j: number) => (j + offset) % n

        work[0] = 0
        steps[0] = 3

        for (let i = 0; i < rows; i++) {
            const centre = rows > 1 ? (i / (rows - 1)) * (columns - 1) : 0
            const from = Math.max(0, Math.floor(centre - band))
            const to = Math.min(columns - 1, Math.ceil(centre + band))

            for (let j = from; j <= to; j++) {
                if (!i && !j) continue
                let cell = Infinity
                let cellStep = 0
                const ex = a[2 * (i % m)] - fitted[2 * indexB(j)]
                const ey = a[2 * (i % m) + 1] - fitted[2 * indexB(j) + 1]
                const distance = (ex * ex + ey * ey) * scale * scale

                /**
                 * Steps that reach this pair: 1 advances along a, 2 along b,
                 * 3 along both. An a-only step can't follow a b-only step
                 * (or vice versa), as one step along both is always cheaper.
                 */
                for (let step = 1; step < 4; step++) {
                    const pi = i - (step & 1)
                    const pj = j - (step >> 1)
                    if (pi < 0 || pj < 0) continue
                    const previous = work[pi * columns + pj]
                    const previousStep = steps[pi * columns + pj]
                    if (previous === Infinity || (previousStep ^ step) === 3) {
                        continue
                    }

                    const lengthA = step & 1 ? edgesA[pi % m] : 0
                    const lengthB = step & 2 ? edgesB[indexB(pj)] : 0

                    /**
                     * Repeated points take an even share of the corner either
                     * side of them, so a corner is matched once in total.
                     */
                    const turnA =
                        ((previousStep & 1) + (step & 1)) * 0.5 * turnsA[pi % m]
                    const turnB =
                        ((previousStep >> 1) + (step >> 1)) *
                        0.5 *
                        turnsB[indexB(pj)]

                    /**
                     * A point that waits while the other outline moves on
                     * fans out into an edge. That's natural at a corner,
                     * which rounds off, but kinks a straight outline.
                     */
                    const fan =
                        step < 3
                            ? 1 -
                              FAN *
                                  Math.min(
                                      1,
                                      Math.abs(
                                          step & 1
                                              ? turnsB[indexB(pj)]
                                              : turnsA[pi % m]
                                      ) /
                                          (Math.PI / 2)
                                  )
                            : 1

                    const total =
                        previous +
                        (MOVE * distance * (lengthA + lengthB)) / 2 +
                        (fan * 2 * (lengthA - lengthB) ** 2) /
                            (lengthA + lengthB || 1) +
                        BEND * Math.abs(turnA - turnB)

                    if (total < cell) {
                        cell = total
                        cellStep = step
                    }
                }

                work[i * columns + j] = cell
                steps[i * columns + j] = cellStep
            }
        }

        const total = work[rows * columns - 1] + ROTATE * angle * angle
        if (total < bestWork) {
            bestWork = total
            best = []
            let i = rows - 1
            let j = columns - 1
            while (closed ? i || j : i >= 0) {
                // Pushed b-first, so reversing leaves [a, b] pairs
                best.push(indexB(j), (i + sharpest) % m)
                const step = steps[i * columns + j]
                if (!step) break
                i -= step & 1
                j -= step >> 1
            }
            best.reverse()
        }
    }

    return best
}

/**
 * Points can be closer together on one outline than the other, so the
 * cheapest path repeats a point wherever it pairs with a run of the other
 * outline's points, and in-between shapes kink where points repeat. So the
 * path is read as a map from distance along a to distance along b instead,
 * passing through the middle of each run, and every point of each outline
 * is paired with the point at its mapped distance along the other. Both
 * outlines keep every corner, and no point repeats.
 */
function expand(
    a: Points,
    b: Points,
    pairs: number[],
    closed: boolean
): [Points, Points] {
    const distancesA = distances(a, closed)
    const distancesB = distances(b, closed)
    const count = pairs.length / 2
    const previous = (k: number) => 2 * ((k + count - 1) % count)
    const sharesPoint = (k: number) =>
        pairs[2 * k] === pairs[previous(k)] ||
        pairs[2 * k + 1] === pairs[previous(k) + 1]

    // Start between runs, so that none wraps round the end
    let start = 0
    while (closed && start < count - 1 && sharesPoint(start)) start++

    // The middle of each run, unwrapped so distances keep increasing
    const us: number[] = []
    const vs: number[] = []
    let u = 0
    let v = 0
    let size = 0
    let wrapsA = 0
    let wrapsB = 0
    for (let k = 0; k <= count; k++) {
        const p = (start + k) % count
        if (k && (k === count || !sharesPoint(p))) {
            us.push(u / size)
            vs.push(v / size)
            u = v = size = 0
        }
        if (k === count) break
        if (k) {
            if (pairs[2 * p] < pairs[previous(p)]) wrapsA++
            if (pairs[2 * p + 1] < pairs[previous(p) + 1]) wrapsB++
        }
        u += distancesA[pairs[2 * p]] + wrapsA
        v += distancesB[pairs[2 * p + 1]] + wrapsB
        size++
    }

    const last = us.length - 1
    if (closed) {
        us.push(us[0] + 1)
        vs.push(vs[0] + 1)
    } else {
        // Open ends always pair with each other
        us[0] = vs[0] = 0
        us[last || 1] = vs[last || 1] = 1
    }

    const entries: number[][] = []
    distancesA.forEach((x, i) => {
        if (closed && x < us[0]) x++
        entries.push([x, map(us, vs, x), i, -1])
    })
    distancesB.forEach((y, j) => {
        if (closed && y < vs[0]) y++
        entries.push([map(vs, us, y), y, -1, j])
    })
    entries.sort((p, q) => p[0] - q[0])

    const ea: Points = []
    const eb: Points = []
    const snap = SNAP / entries.length
    for (let e = 0; e < entries.length; e++) {
        let [x, y, i, j] = entries[e]
        const next = entries[e + 1]
        // A point of each outline in almost the same place pair up directly
        if (next && (i < 0) !== (next[2] < 0) && next[0] - x < snap) {
            i = Math.max(i, next[2])
            j = Math.max(j, next[3])
            e++
        }
        ea.push(
            ...(i < 0 ? at(a, distancesA, x, closed) : [a[2 * i], a[2 * i + 1]])
        )
        eb.push(
            ...(j < 0 ? at(b, distancesB, y, closed) : [b[2 * j], b[2 * j + 1]])
        )
    }
    return [ea, eb]
}

/**
 * Points closer together than this share of the average spacing pair up
 * directly.
 */
const SNAP = 0.5

/**
 * Piecewise linear interpolation through (xs, ys), where xs increase.
 */
function map(xs: number[], ys: number[], x: number) {
    let g = 0
    while (g < xs.length - 2 && xs[g + 1] <= x) g++
    return ys[g] + ((x - xs[g]) / (xs[g + 1] - xs[g] || 1)) * (ys[g + 1] - ys[g])
}

/**
 * How far along the outline each point is, as a share of its length.
 */
function distances(points: Points, closed: boolean) {
    const lengths = edges(points, closed)
    const result = [0]
    for (let i = 1; i < lengths.length; i++) {
        result.push(result[i - 1] + lengths[i - 1])
    }
    return result
}

/**
 * The point a share `s` of the way along an outline.
 */
function at(points: Points, distances: number[], s: number, closed: boolean) {
    const n = distances.length
    if (closed) s -= Math.floor(s)
    let i = 0
    while (i < n - 1 && distances[i + 1] <= s) i++
    const j = closed ? (i + 1) % n : Math.min(i + 1, n - 1)
    const t = (s - distances[i]) / ((distances[i + 1] ?? 1) - distances[i] || 1)
    return [
        points[2 * i] + (points[2 * j] - points[2 * i]) * t,
        points[2 * i + 1] + (points[2 * j + 1] - points[2 * i + 1]) * t,
    ]
}

/**
 * Edge lengths as a share of the perimeter, so shapes of any size compare.
 */
function edges(points: Points, closed: boolean) {
    const n = points.length / 2
    const total = perimeter(points, closed) || 1
    const lengths = new Float64Array(n)
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        lengths[i] =
            i < n - 1 || closed
                ? hypot(
                      points[2 * j] - points[2 * i],
                      points[2 * j + 1] - points[2 * i + 1]
                  ) / total
                : 0
    }
    return lengths
}

/**
 * The angle the outline turns through at each point, in -π to π.
 */
function turns(points: Points, closed: boolean) {
    const n = points.length / 2
    const angles = new Float64Array(n)
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
        const h = (i + n - 1) % n
        const j = (i + 1) % n
        angles[i] = wrap(
            Math.atan2(
                points[2 * j + 1] - points[2 * i + 1],
                points[2 * j] - points[2 * i]
            ) -
                Math.atan2(
                    points[2 * i + 1] - points[2 * h + 1],
                    points[2 * i] - points[2 * h]
                )
        )
    }
    return angles
}

export const wrap = (angle: number) =>
    angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI))

/**
 * The angle that best turns b onto a, about their centres, when b's point
 * `offset` pairs with a's first point and both are followed evenly by
 * length.
 */
function fit(
    a: Points,
    b: Points,
    offset: number,
    ax: number,
    ay: number,
    bx: number,
    by: number
) {
    const samplesA = sample(a)
    const samplesB = sample(b.slice(2 * offset).concat(b.slice(0, 2 * offset)))
    let dot = 0
    let cross = 0
    for (let i = 0; i < 4 * SAMPLES; i += 4) {
        const x0 = samplesA[i] - ax
        const y0 = samplesA[i + 1] - ay
        const x1 = samplesB[i] - bx
        const y1 = samplesB[i + 1] - by
        dot += x0 * x1 + y0 * y1
        cross += x1 * y0 - y1 * x0
    }
    return Math.atan2(cross, dot)
}

/**
 * Point indices on b to try pairing with a's first point, its sharpest
 * corner. Those are b's corners that turn most like it, and the best fits
 * of b's whole outline: both outlines are sampled evenly by length, and
 * every rotation of b's samples is scored by how far the points travel
 * and by how well the outlines' directions line up if b turned to fit.
 */
function startPoints(
    a: Points,
    b: Points,
    corner: number,
    turnsB: ArrayLike<number>
): number[] {
    const samplesA = sample(a)
    const samplesB = sample(b)
    const distances: number[] = []
    const directions: number[] = []
    for (let r = 0; r < SAMPLES; r++) {
        let distance = 0
        let x = 0
        let y = 0
        for (let i = 0; i < SAMPLES; i++) {
            const p = 4 * i
            const q = 4 * ((i + r) % SAMPLES)
            distance +=
                (samplesA[p] - samplesB[q]) ** 2 +
                (samplesA[p + 1] - samplesB[q + 1]) ** 2
            const angle = samplesA[p + 3] - samplesB[q + 3]
            x += Math.cos(angle)
            y += Math.sin(angle)
        }
        distances.push(distance)
        directions.push(-hypot(x, y))
    }

    const starts = new Set<number>()
    if (Math.abs(corner) > CORNER) {
        const corners: number[] = []
        const n = turnsB.length
        for (let j = 0; j < n; j++) {
            const turn = turnsB[j]
            if (
                turn * corner > (corner * corner) / 2 &&
                Math.abs(turn) >= Math.abs(turnsB[(j + n - 1) % n]) &&
                Math.abs(turn) >= Math.abs(turnsB[(j + 1) % n])
            ) {
                corners.push(j)
            }
        }
        corners.sort(
            (x, y) => Math.abs(turnsB[x] - corner) - Math.abs(turnsB[y] - corner)
        )
        for (const j of corners.slice(0, 3)) starts.add(j)
    }
    for (const scores of [distances, directions]) {
        const minima: number[] = []
        for (let r = 0; r < SAMPLES; r++) {
            const score = scores[r]
            if (
                score <= scores[(r + SAMPLES - 1) % SAMPLES] &&
                score <= scores[(r + 1) % SAMPLES]
            ) {
                minima.push(r)
            }
        }
        minima.sort((x, y) => scores[x] - scores[y])
        for (const r of minima.slice(0, 2)) starts.add(samplesB[4 * r + 2])
    }
    return [...starts]
}

const SAMPLES = 64

/**
 * Turns sharper than this (radians) count as corners.
 */
const CORNER = 0.3

/**
 * SAMPLES points spaced evenly along a closed outline, each with the
 * index of the nearest outline point and the outline's direction there:
 * [x, y, index, direction, ...].
 */
function sample(points: Points) {
    const n = points.length / 2
    const step = perimeter(points, true) / SAMPLES
    const samples: number[] = []
    let i = 0
    let travelled = 0
    let edge = hypot(points[2] - points[0], points[3] - points[1])

    for (let s = 0; s < SAMPLES; s++) {
        const target = s * step
        while (travelled + edge < target && i < n - 1) {
            travelled += edge
            i++
            const j = (i + 1) % n
            edge = hypot(
                points[2 * j] - points[2 * i],
                points[2 * j + 1] - points[2 * i + 1]
            )
        }
        const j = (i + 1) % n
        const dx = points[2 * j] - points[2 * i]
        const dy = points[2 * j + 1] - points[2 * i + 1]
        const t = edge ? (target - travelled) / edge : 0
        samples.push(
            points[2 * i] + dx * t,
            points[2 * i + 1] + dy * t,
            t > 0.5 ? j : i,
            Math.atan2(dy, dx)
        )
    }
    return samples
}
