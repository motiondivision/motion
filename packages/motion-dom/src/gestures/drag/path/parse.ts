/**
 * Flatten SVG path data into polylines, one per subpath, as flat
 * `[x0, y0, x1, y1, ...]` points with whether each was closed by `Z`.
 *
 * Browsers can measure a path with `getPointAtLength()`, but each call
 * walks the whole path, flattening its curves again: sampling a path of a
 * few dozen curves this way takes seconds.
 *
 * Curves are split into steps of about `step` units.
 */
export function flattenPath(
    d: string,
    step: number
): Array<[number[], boolean]> {
    const tokens =
        d.match(/[a-df-z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || []
    const subpaths: Array<[number[], boolean]> = []
    let points: number[] = []
    let i = 0
    let command = ""
    let previous = ""
    // The current point, the subpath's start, and the last control point
    let x = 0
    let y = 0
    let startX = 0
    let startY = 0
    let controlX = 0
    let controlY = 0

    const read = () => +tokens[i++]

    /**
     * Arc flags can be written without separators, as in `a1 1 0 011 1`.
     */
    const readFlag = () => {
        const token = tokens[i]
        if (token.length > 1) {
            tokens[i] = token.slice(1)
            return token[0] === "1"
        }
        i++
        return token === "1"
    }

    const end = (closed: boolean) => {
        points.length > 2 && subpaths.push([points, closed])
        points = []
    }

    const lineTo = (toX: number, toY: number) => {
        if (!points.length) points.push(x, y)
        points.push((x = toX), (y = toY))
    }

    /**
     * Split into enough steps that each is about `step` long, from the
     * length of the curve's control polygon (never shorter than it).
     */
    const steps = (length: number) =>
        Math.min(100, Math.max(1, Math.ceil(length / step)))

    const cubic = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        toX: number,
        toY: number
    ) => {
        const fromX = x
        const fromY = y
        const n = steps(
            Math.hypot(x1 - x, y1 - y) +
                Math.hypot(x2 - x1, y2 - y1) +
                Math.hypot(toX - x2, toY - y2)
        )
        for (let k = 1; k <= n; k++) {
            const t = k / n
            const u = 1 - t
            const a = u * u * u
            const b = 3 * u * u * t
            const c = 3 * u * t * t
            const e = t * t * t
            lineTo(
                a * fromX + b * x1 + c * x2 + e * toX,
                a * fromY + b * y1 + c * y2 + e * toY
            )
        }
        controlX = x2
        controlY = y2
    }

    /**
     * The endpoint to centre conversion from the SVG spec (F.6.5).
     */
    const arc = (
        rx: number,
        ry: number,
        rotation: number,
        large: boolean,
        sweep: boolean,
        toX: number,
        toY: number
    ) => {
        rx = Math.abs(rx)
        ry = Math.abs(ry)
        if (!rx || !ry) return lineTo(toX, toY)

        const angle = (rotation * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const halfX = (x - toX) / 2
        const halfY = (y - toY) / 2
        const px = cos * halfX + sin * halfY
        const py = cos * halfY - sin * halfX

        // Scale up radii too small to reach the endpoint
        const lambda = (px * px) / (rx * rx) + (py * py) / (ry * ry)
        if (lambda > 1) {
            rx *= Math.sqrt(lambda)
            ry *= Math.sqrt(lambda)
        }

        const rxSq = rx * rx * py * py
        const rySq = ry * ry * px * px
        const coefficient =
            (large === sweep ? -1 : 1) *
            Math.sqrt(
                Math.max(0, (rx * rx * ry * ry - rxSq - rySq) / (rxSq + rySq))
            )
        const ccx = (coefficient * rx * py) / ry
        const ccy = (-coefficient * ry * px) / rx
        const centerX = cos * ccx - sin * ccy + (x + toX) / 2
        const centerY = sin * ccx + cos * ccy + (y + toY) / 2

        const from = Math.atan2((py - ccy) / ry, (px - ccx) / rx)
        let delta = Math.atan2((-py - ccy) / ry, (-px - ccx) / rx) - from
        if (sweep && delta < 0) delta += 2 * Math.PI
        if (!sweep && delta > 0) delta -= 2 * Math.PI

        const n = steps(Math.abs(delta) * Math.max(rx, ry))
        for (let k = 1; k <= n; k++) {
            const theta = from + (delta * k) / n
            const ex = rx * Math.cos(theta)
            const ey = ry * Math.sin(theta)
            lineTo(
                k < n ? centerX + cos * ex - sin * ey : toX,
                k < n ? centerY + sin * ex + cos * ey : toY
            )
        }
    }

    while (i < tokens.length) {
        if (/^[a-df-z]$/i.test(tokens[i])) command = tokens[i++]

        const type = command.toLowerCase()
        // Relative commands are offset by the current point
        const ox = command === type ? x : 0
        const oy = command === type ? y : 0
        const isCubic = previous === "c" || previous === "s"
        const isQuadratic = previous === "q" || previous === "t"
        previous = type

        if (type === "m") {
            end(false)
            x = startX = read() + ox
            y = startY = read() + oy
            // Further pairs are lines
            command = command === "m" ? "l" : "L"
        } else if (type === "l") {
            lineTo(read() + ox, read() + oy)
        } else if (type === "h") {
            lineTo(read() + ox, y)
        } else if (type === "v") {
            lineTo(x, read() + oy)
        } else if (type === "c") {
            cubic(
                read() + ox,
                read() + oy,
                read() + ox,
                read() + oy,
                read() + ox,
                read() + oy
            )
        } else if (type === "s") {
            cubic(
                isCubic ? 2 * x - controlX : x,
                isCubic ? 2 * y - controlY : y,
                read() + ox,
                read() + oy,
                read() + ox,
                read() + oy
            )
        } else if (type === "q" || type === "t") {
            const qx =
                type === "q" ? read() + ox : isQuadratic ? 2 * x - controlX : x
            const qy =
                type === "q" ? read() + oy : isQuadratic ? 2 * y - controlY : y
            const toX = read() + ox
            const toY = read() + oy

            // A quadratic is a cubic with controls 2/3 of the way to its own
            cubic(
                x + ((qx - x) * 2) / 3,
                y + ((qy - y) * 2) / 3,
                toX + ((qx - toX) * 2) / 3,
                toY + ((qy - toY) * 2) / 3,
                toX,
                toY
            )
            controlX = qx
            controlY = qy
        } else if (type === "a") {
            arc(
                read(),
                read(),
                read(),
                readFlag(),
                readFlag(),
                read() + ox,
                read() + oy
            )
        } else {
            // `Z`, or anything unreadable, which ends the path
            if (type !== "z") break
            lineTo(startX, startY)
            end(true)
            command = ""
        }
    }
    end(false)

    return subpaths
}
