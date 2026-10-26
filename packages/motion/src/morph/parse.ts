/**
 * A cubic Bézier: x0 y0 x1 y1 x2 y2 x3 y3. Every path command is stored as
 * cubics, so the flattener only has one kind of segment to handle.
 */
export type Cubic = number[]

export interface Subpath {
    segments: Cubic[]
    closed: boolean
}

const numberPattern = /[\s,]*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)/iy
const commandPattern = /[\s,]*([mlhvcsqtaz])/iy
const flagPattern = /[\s,]*([01])/y

/**
 * Read SVG path data into subpaths of cubics. Like a browser, it stops at
 * the first malformed token, or number too large to draw, and keeps
 * everything before it.
 */
export function parsePath(d: string): Subpath[] {
    const subpaths: Subpath[] = []
    let segments: Cubic[] = []
    let index = 0
    let x = 0
    let y = 0
    let startX = 0
    let startY = 0
    let controlX = 0
    let controlY = 0
    let command = ""
    let previous = ""

    const read = (pattern: RegExp) => {
        pattern.lastIndex = index
        const match = pattern.exec(d)
        if (!match) throw 0
        index = pattern.lastIndex
        return match[1]
    }
    const num = () => {
        const value = +read(numberPattern)
        if (!isFinite(value)) throw 0
        return value
    }
    const flag = () => +read(flagPattern)

    const cubic = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        x3: number,
        y3: number
    ) => {
        segments.push([x, y, x1, y1, x2, y2, x3, y3])
        x = x3
        y = y3
    }

    const line = (x3: number, y3: number) =>
        cubic(
            x + (x3 - x) / 3,
            y + (y3 - y) / 3,
            x3 + (x - x3) / 3,
            y3 + (y - y3) / 3,
            x3,
            y3
        )

    const quadratic = (qx: number, qy: number, x3: number, y3: number) => {
        controlX = qx
        controlY = qy
        cubic(
            x + ((qx - x) * 2) / 3,
            y + ((qy - y) * 2) / 3,
            x3 + ((qx - x3) * 2) / 3,
            y3 + ((qy - y3) * 2) / 3,
            x3,
            y3
        )
    }

    const end = (closed: boolean) => {
        segments.length && subpaths.push({ segments, closed })
        segments = []
    }

    try {
        while (index < d.length) {
            commandPattern.lastIndex = index
            if (commandPattern.test(d)) {
                command = read(commandPattern)
            } else if (/^z?$/i.test(command)) {
                // Nothing can follow a close, and data must start with a command
                break
            }

            const type = command.toUpperCase()
            const ox = command === type ? 0 : x
            const oy = command === type ? 0 : y

            if (type === "M") {
                end(false)
                x = startX = ox + num()
                y = startY = oy + num()
                // Further coordinate pairs are lines
                command = command === "m" ? "l" : "L"
            } else if (type === "L") {
                line(ox + num(), oy + num())
            } else if (type === "H") {
                line(ox + num(), y)
            } else if (type === "V") {
                line(x, oy + num())
            } else if (type === "C" || type === "S") {
                const reflect = /[CS]/.test(previous)
                const x1 =
                    type === "C" ? ox + num() : reflect ? 2 * x - controlX : x
                const y1 =
                    type === "C" ? oy + num() : reflect ? 2 * y - controlY : y
                controlX = ox + num()
                controlY = oy + num()
                cubic(x1, y1, controlX, controlY, ox + num(), oy + num())
            } else if (type === "Q") {
                const qx = ox + num()
                quadratic(qx, oy + num(), ox + num(), oy + num())
            } else if (type === "T") {
                const reflect = /[QT]/.test(previous)
                quadratic(
                    reflect ? 2 * x - controlX : x,
                    reflect ? 2 * y - controlY : y,
                    ox + num(),
                    oy + num()
                )
            } else if (type === "A") {
                const rx = num()
                const ry = num()
                const angle = num()
                const large = flag()
                const sweep = flag()
                arc(x, y, rx, ry, angle, large, sweep, ox + num(), oy + num())
            } else {
                if (x !== startX || y !== startY) line(startX, startY)
                end(true)
            }

            previous = type
        }
    } catch (e) {}

    end(false)
    return subpaths

    function arc(
        x0: number,
        y0: number,
        rx: number,
        ry: number,
        angle: number,
        large: number,
        sweep: number,
        x3: number,
        y3: number
    ) {
        if (x0 === x3 && y0 === y3) return
        rx = Math.abs(rx)
        ry = Math.abs(ry)
        if (!rx || !ry) return line(x3, y3)

        // Endpoint to centre parameterisation, SVG 2 appendix B.2.4
        const phi = (angle * Math.PI) / 180
        const sin = Math.sin(phi)
        const cos = Math.cos(phi)
        const hx = (x0 - x3) / 2
        const hy = (y0 - y3) / 2
        const px = cos * hx + sin * hy
        const py = cos * hy - sin * hx
        const lambda = (px * px) / (rx * rx) + (py * py) / (ry * ry)
        if (lambda > 1) {
            rx *= Math.sqrt(lambda)
            ry *= Math.sqrt(lambda)
        }
        const a = rx * rx * py * py
        const b = ry * ry * px * px
        const k =
            (large === sweep ? -1 : 1) *
            Math.sqrt(Math.max(0, (rx * rx * ry * ry - a - b) / (a + b)))
        const cx = (k * rx * py) / ry
        const cy = (-k * ry * px) / rx
        const start = Math.atan2((py - cy) / ry, (px - cx) / rx)
        let delta = Math.atan2((-py - cy) / ry, (-px - cx) / rx) - start
        if (sweep && delta < 0) delta += 2 * Math.PI
        if (!sweep && delta > 0) delta -= 2 * Math.PI

        // Split into arcs of 90° or less, each closely fit by one cubic
        const count = Math.max(
            1,
            Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9)
        )
        const step = delta / count
        const handle = (4 / 3) * Math.tan(step / 4)
        const centreX = cos * cx - sin * cy + (x0 + x3) / 2
        const centreY = sin * cx + cos * cy + (y0 + y3) / 2

        // Point (and handle, scaled by `h`) on the ellipse at angle `t`
        const pointX = (t: number, h: number) =>
            centreX +
            rx * cos * (Math.cos(t) - h * Math.sin(t)) -
            ry * sin * (Math.sin(t) + h * Math.cos(t))
        const pointY = (t: number, h: number) =>
            centreY +
            rx * sin * (Math.cos(t) - h * Math.sin(t)) +
            ry * cos * (Math.sin(t) + h * Math.cos(t))

        for (let i = 0; i < count; i++) {
            const t0 = start + i * step
            const t1 = t0 + step
            const last = i === count - 1
            cubic(
                pointX(t0, handle),
                pointY(t0, handle),
                pointX(t1, -handle),
                pointY(t1, -handle),
                last ? x3 : pointX(t1, 0),
                last ? y3 : pointY(t1, 0)
            )
        }
    }
}
