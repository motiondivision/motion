import { hypot, Points } from "./geometry"
import { wrap } from "./correspond"

/**
 * Writes the shape `t` of the way from a to b into `out`.
 */
export type Blend = (t: number, out: Points) => void

/**
 * Blend two polylines with the same number of points.
 *
 * By default each edge's length and direction is interpolated and the
 * edges are walked end to end, after Sederberg et al. 1993. Parts that
 * rotate keep their length instead of shrinking towards the middle, as
 * they do when each point moves in a straight line. `linear` moves each
 * point in a straight line, as does any pair the intrinsic blend can't
 * handle (a point, or outlines that wind a different number of times).
 */
export function blend(a: Points, b: Points, closed: boolean, linear?: boolean): Blend {
    const n = a.length / 2
    const count = closed ? n : n - 1
    const anglesA = !linear && angles(a, count)
    const anglesB = !linear && angles(b, count)

    const lerp: Blend = (t, out) => {
        for (let i = 0; i < 2 * n; i++) out[i] = a[i] + (b[i] - a[i]) * t
    }

    if (!anglesA || !anglesB) return lerp

    const lengthsA = new Float64Array(count)
    const lengthsB = new Float64Array(count)
    for (let i = 0; i < count; i++) {
        const j = (i + 1) % n
        lengthsA[i] = hypot(a[2 * j] - a[2 * i], a[2 * j + 1] - a[2 * i + 1])
        lengthsB[i] = hypot(b[2 * j] - b[2 * i], b[2 * j + 1] - b[2 * i + 1])
    }

    /**
     * How far each edge turns. Following the outline keeps the turns of
     * neighbouring edges consistent, so a part that turns by more than
     * half a revolution relative to the rest doesn't flip the short way.
     */
    const rotations = new Float64Array(count)
    let rotation = wrap(anglesB[0] - anglesA[0])
    let weightedRotation = 0
    let totalLength = 0
    for (let i = 0; i < count; i++) {
        if (i) {
            rotation +=
                wrap(anglesB[i] - anglesB[i - 1]) -
                wrap(anglesA[i] - anglesA[i - 1])
        }
        rotations[i] = rotation
        weightedRotation += rotation * (lengthsA[i] + lengthsB[i])
        totalLength += lengthsA[i] + lengthsB[i]
    }

    if (closed) {
        /**
         * Following the outline all the way round should arrive back at
         * the first edge's rotation. It doesn't when the outlines wind a
         * different number of times, which edge blending can't bridge.
         */
        const back =
            rotation +
            wrap(anglesB[0] - anglesB[count - 1]) -
            wrap(anglesA[0] - anglesA[count - 1])
        if (Math.abs(back - rotations[0]) > 1) return lerp
    }

    // Turn the whole shape the short way round
    const turn =
        2 * Math.PI * Math.round(weightedRotation / totalLength / (2 * Math.PI))
    for (let i = 0; i < count; i++) rotations[i] -= turn

    /**
     * Walking the blended edges doesn't quite arrive where the outline
     * should end, so the gap is shared out along the outline, most of it
     * to the edges that change length the most. This is the least-squares
     * adjustment of Sederberg et al. 1993, sec. 2.1, with points free to
     * move in any direction.
     */
    let largestChange = 0
    for (let i = 0; i < count; i++) {
        largestChange = Math.max(
            largestChange,
            Math.abs(lengthsA[i] - lengthsB[i])
        )
    }
    // Every edge takes a little, so there's always a way to close the gap
    const tolerance = largestChange * 1e-4 || 1
    const shares = new Float64Array(n + 1)
    for (let i = 0; i < count; i++) {
        shares[i + 1] =
            shares[i] +
            Math.max(Math.abs(lengthsA[i] - lengthsB[i]), tolerance) ** 2
    }

    const last = 2 * n - 2
    let centreAX = 0
    let centreAY = 0
    let centreBX = 0
    let centreBY = 0
    for (let i = 0; i < 2 * n; i += 2) {
        centreAX += a[i] / n
        centreAY += a[i + 1] / n
        centreBX += b[i] / n
        centreBY += b[i + 1] / n
    }
    const areaA = area(a)
    const areaB = area(b)

    return (t, out) => {
        let x = 0
        let y = 0
        for (let i = 0; i < n; i++) {
            out[2 * i] = x
            out[2 * i + 1] = y
            if (i < count) {
                const angle = anglesA[i] + rotations[i] * t
                const length = Math.max(
                    0,
                    lengthsA[i] + (lengthsB[i] - lengthsA[i]) * t
                )
                x += length * Math.cos(angle)
                y += length * Math.sin(angle)
            }
        }

        /**
         * The walk should end back at the start of a closed outline, or
         * at the blend of where the two open ends are.
         */
        if (!closed) {
            x -= a[last] - a[0] + (b[last] - b[0] - a[last] + a[0]) * t
            y -= a[last + 1] - a[1] + (b[last + 1] - b[1] - a[last + 1] + a[1]) * t
        }

        let centreX = 0
        let centreY = 0
        for (let i = 0; i < n; i++) {
            const share = shares[i] / shares[count]
            out[2 * i] -= x * share
            out[2 * i + 1] -= y * share
            centreX += out[2 * i] / n
            centreY += out[2 * i + 1] / n
        }

        if (!closed) {
            // Open outlines keep their start on the blend of the two starts
            for (let i = 0; i < 2 * n; i += 2) {
                out[i] += a[0] + (b[0] - a[0]) * t
                out[i + 1] += a[1] + (b[1] - a[1]) * t
            }
            return
        }

        /**
         * Closed outlines keep their centre on the blend of the two
         * centres. Keeping edges at length puffs a spiky outline up as it
         * rounds off, so the outline is also scaled to the blend of the two
         * areas.
         */
        const ratio = (areaA + (areaB - areaA) * t) / area(out)
        const scale = ratio > 0 ? Math.sqrt(ratio) : 1
        for (let i = 0; i < 2 * n; i += 2) {
            out[i] = centreAX + (centreBX - centreAX) * t + (out[i] - centreX) * scale
            out[i + 1] =
                centreAY + (centreBY - centreAY) * t + (out[i + 1] - centreY) * scale
        }
    }
}

/**
 * Signed area of a closed polyline.
 */
function area(points: Points) {
    let sum = 0
    const n = points.length
    for (let i = 0; i < n; i += 2) {
        sum += points[i] * points[(i + 3) % n] - points[(i + 2) % n] * points[i + 1]
    }
    return sum / 2
}

/**
 * The direction of each edge. Repeated points make edges of no length,
 * which take the direction halfway between the edges either side, as if
 * the points were spread along a tiny straight line (Sederberg &
 * Greenwood 1992, sec. 2.2).
 */
function angles(points: Points, count: number) {
    const n = points.length / 2
    const directions = new Float64Array(count).fill(NaN)
    let any = false
    for (let i = 0; i < count; i++) {
        const j = (i + 1) % n
        const dx = points[2 * j] - points[2 * i]
        const dy = points[2 * j + 1] - points[2 * i + 1]
        if (dx || dy) {
            directions[i] = Math.atan2(dy, dx)
            any = true
        }
    }
    if (!any) return

    const closed = count === n
    for (let i = 0; i < count; i++) {
        if (!isNaN(directions[i])) continue
        let before = NaN
        let after = NaN
        for (let k = 1; k <= count && (isNaN(before) || isNaN(after)); k++) {
            const h = i - k
            const j = i + k
            if (isNaN(before) && (closed || h >= 0)) {
                before = directions[(h + count) % count]
            }
            if (isNaN(after) && (closed || j < count)) {
                after = directions[j % count]
            }
        }
        if (isNaN(before)) before = after
        if (isNaN(after)) after = before
        directions[i] = before + wrap(after - before) / 2
    }
    return directions
}
