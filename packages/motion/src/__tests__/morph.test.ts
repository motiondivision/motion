import { animate, interpolate, motionValue, transform } from "framer-motion/dom"
import { morph } from "../morph"

/**
 * Geometry helpers for reading morph output, which is written as
 * `M x y x y ... [Z]` per subpath.
 */
type Point = [number, number]

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])
interface Subpath {
    points: Point[]
    closed: boolean
}

function read(d: string): Subpath[] {
    return d
        .split(/(?=M)/)
        .filter((part) => part.trim())
        .map((part) => {
            const numbers = part
                .replace(/[MLZ]/g, " ")
                .trim()
                .split(/[\s,]+/)
                .map(Number)
            const points: Point[] = []
            for (let i = 0; i < numbers.length; i += 2) {
                points.push([numbers[i], numbers[i + 1]])
            }
            return { points, closed: /Z\s*$/.test(part) }
        })
}

const area = ({ points }: Subpath) => {
    let sum = 0
    for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i]
        const [x1, y1] = points[(i + 1) % points.length]
        sum += x0 * y1 - x1 * y0
    }
    return sum / 2
}

// Area-weighted, so it doesn't depend on how densely the outline is drawn
const centroid = ({ points }: Subpath): Point => {
    let sum = 0
    let x = 0
    let y = 0
    for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i]
        const [x1, y1] = points[(i + 1) % points.length]
        const cross = x0 * y1 - x1 * y0
        sum += cross
        x += (x0 + x1) * cross
        y += (y0 + y1) * cross
    }
    return [x / (3 * sum), y / (3 * sum)]
}

const perimeter = ({ points }: Subpath) => {
    let length = 0
    for (let i = 0; i < points.length; i++) {
        length += distance(points[i], points[(i + 1) % points.length])
    }
    return length
}

function inside([x, y]: Point, { points }: Subpath) {
    let isInside = false
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i]
        const [xj, yj] = points[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            isInside = !isInside
        }
    }
    return isInside
}

function segmentDistance(p: Point, a: Point, b: Point) {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared
        ? Math.max(
              0,
              Math.min(
                  1,
                  ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared
              )
          )
        : 0
    return distance(p, [a[0] + t * dx, a[1] + t * dy])
}

// How close two closed polylines come to each other
const clearance = (a: Subpath, b: Subpath) => {
    let least = Infinity
    for (const [from, to] of [
        [a, b],
        [b, a],
    ]) {
        for (const p of from.points) {
            to.points.forEach((q, i) => {
                const next = to.points[(i + 1) % to.points.length]
                least = Math.min(least, segmentDistance(p, q, next))
            })
        }
    }
    return least
}

function crosses(a: Subpath, b: Subpath) {
    const cross = (o: Point, p: Point, q: Point) =>
        (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
    for (let i = 0; i < a.points.length; i++) {
        const p0 = a.points[i]
        const p1 = a.points[(i + 1) % a.points.length]
        for (let j = 0; j < b.points.length; j++) {
            const q0 = b.points[j]
            const q1 = b.points[(j + 1) % b.points.length]
            if (
                cross(p0, p1, q0) * cross(p0, p1, q1) < 0 &&
                cross(q0, q1, p0) * cross(q0, q1, p1) < 0
            ) {
                return true
            }
        }
    }
    return false
}

// The bounds of a subpath: [minX, maxX, minY, maxY]
const span = ({ points }: Subpath) => {
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
}

const circle = (cx: number, cy: number, r: number, sweep = 1) =>
    `M${cx - r} ${cy}A${r} ${r} 0 1 ${sweep} ${
        cx + r
    } ${cy}A${r} ${r} 0 1 ${sweep} ${cx - r} ${cy}Z`

const rect = (x: number, y: number, w: number, h: number, clockwise = true) =>
    clockwise
        ? `M${x} ${y}H${x + w}V${y + h}H${x}Z`
        : `M${x} ${y}V${y + h}H${x + w}V${y}Z`

/**
 * A polygon with a hole a constant `width` inside its edges, like an
 * outline converted to a path.
 */
function outlined(points: number[][], width: number) {
    const n = points.length
    const lines = points.map(([x0, y0], i) => {
        const [x1, y1] = points[(i + 1) % n]
        const length = Math.hypot(x1 - x0, y1 - y0)
        // Clockwise on screen, so the inside is to the right
        const nx = (-(y1 - y0) / length) * width
        const ny = ((x1 - x0) / length) * width
        return [x0 + nx, y0 + ny, x1 - x0, y1 - y0]
    })
    const inset = lines.map(([bx, by, bdx, bdy], i) => {
        const [ax, ay, adx, ady] = lines[(i + n - 1) % n]
        const s = ((bx - ax) * bdy - (by - ay) * bdx) / (adx * bdy - ady * bdx)
        return [ax + adx * s, ay + ady * s]
    })
    return polygon(points) + polygon(inset.reverse())
}

const polygon = (points: number[][]) =>
    "M" + points.map((p) => p.join(" ")).join("L") + "Z"

/**
 * Polygons with and without concave corners, for outlining.
 */
const L = [
    [0, 0],
    [30, 0],
    [30, 70],
    [60, 70],
    [60, 100],
    [0, 100],
]
const T = [
    [0, 0],
    [100, 0],
    [100, 30],
    [65, 30],
    [65, 100],
    [35, 100],
    [35, 30],
    [0, 30],
]
const U = [
    [0, 0],
    [25, 0],
    [25, 70],
    [75, 70],
    [75, 0],
    [100, 0],
    [100, 100],
    [0, 100],
]
const plus = [
    [35, 0],
    [65, 0],
    [65, 35],
    [100, 35],
    [100, 65],
    [65, 65],
    [65, 100],
    [35, 100],
    [35, 65],
    [0, 65],
    [0, 35],
    [35, 35],
]
const box = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
]
const shapes = [L, T, U, plus, box]

const square = rect(0, 0, 100, 100)
const star = "M50 0L61 35L98 35L68 57L79 91L50 70L21 91L32 57L2 35L39 35Z"

/**
 * Letters and icons with holes, which move as they change shape.
 */
const P =
    "M10 5H60C80 5 90 18 90 32C90 46 80 60 60 60H30V95H10Z" +
    "M30 22V43H58C65 43 70 38 70 32C70 26 65 22 58 22Z"
const four =
    polygon([
        [60, 5],
        [75, 5],
        [75, 60],
        [90, 60],
        [90, 75],
        [75, 75],
        [75, 95],
        [60, 95],
        [60, 75],
        [10, 75],
        [10, 62],
    ]) +
    polygon([
        [30, 60],
        [60, 60],
        [60, 28],
    ])
const A =
    polygon([
        [40, 5],
        [60, 5],
        [95, 95],
        [75, 95],
        [67, 72],
        [33, 72],
        [25, 95],
        [5, 95],
    ]) +
    polygon([
        [39, 57],
        [61, 57],
        [50, 25],
    ])
const bolt =
    polygon([
        [55, 0],
        [15, 55],
        [45, 55],
        [35, 100],
        [85, 40],
        [55, 40],
        [70, 0],
    ]) +
    polygon([
        [58, 12],
        [48, 47],
        [73, 47],
        [46, 78],
        [52, 50],
        [28, 50],
        [55, 12],
    ])

describe("morph", () => {
    test("returns the original strings at 0 and 1", () => {
        const mix = morph(square, star)!
        expect(mix(0)).toBe(square)
        expect(mix(1)).toBe(star)
    })

    test("returns the target for identical paths", () => {
        expect(morph(square, square)!(0.5)).toBe(square)
    })

    test("writes in-between shapes as finite polylines", () => {
        const d = morph(square, star)!(0.5)
        expect(d).toMatch(/^M[-\d. ]+Z$/)
        const [shape] = read(d)
        expect(shape.points.length).toBeGreaterThan(10)
        for (const [x, y] of shape.points) {
            expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
        }
    })

    test("parses every path command", () => {
        // The same 100x100 square with a rounded top-right corner, written
        // in absolute and relative commands of every kind
        const absolute =
            "M0 0H50Q75 0 87.5 6.25T100 25C100 37.5 100 50 100 50S100 75 100 100V100H0L0 100Z"
        const relative =
            "m0 0h50q25 0 37.5 6.25t12.5 18.75c0 12.5 0 25 0 25s0 25 0 50v0h-100l0 0z"
        const mid = read(morph(absolute, relative)!(0.5))[0]
        const original = read(morph(absolute, rect(0, 0, 1, 1))!(0.001))[0]

        expect(Math.abs(area(mid))).toBeCloseTo(Math.abs(area(original)), -2)
    })

    test("parses compact arc flags", () => {
        const compact = "M0 50a50 50 0 1150 50 50 50 0 01-50-50z"
        const spaced = "M0 50 A50 50 0 1 1 50 100 A50 50 0 0 1 0 50 Z"
        const a = read(morph(compact, square)!(0.0001))[0]
        const b = read(morph(spaced, square)!(0.0001))[0]

        expect(Math.abs(area(a))).toBeCloseTo(Math.abs(area(b)), 0)
        expect(Math.abs(area(a))).toBeGreaterThan(1000)
    })

    test("keeps rotating parts at length, where linear blending shrinks them", () => {
        // An L whose upright swings down 90° about the corner into a bar.
        // Swung rigidly halfway, the upright's tip ends up 185 from the end
        // of the arm, and the outline is as long as the blend of the two.
        const l = "M0 0L100 0L100 10L10 10L10 100L0 100Z"
        const bar = "M-100 0L0 0L100 0L100 10L0 10L-100 10Z"

        const span = (d: string) => {
            const { points } = read(d)[0]
            let longest = 0
            for (const p of points) {
                for (const q of points)
                    longest = Math.max(longest, distance(p, q))
            }
            return longest
        }

        const intrinsic = morph(l, bar)!(0.5)
        const linear = morph(l, bar, { linear: true })!(0.5)
        expect(span(intrinsic)).toBeGreaterThan(180)
        expect(perimeter(read(intrinsic)[0])).toBeCloseTo(410, -1)
        expect(span(linear)).toBeLessThan(165)
        expect(perimeter(read(linear)[0])).toBeLessThan(380)
    })

    test("matches holes by proximity", () => {
        const a = `${rect(0, 0, 200, 100)}${circle(50, 50, 20, 0)}${circle(
            150,
            50,
            20,
            0
        )}`
        const b = `${circle(100, 50, 100)}${rect(30, 30, 40, 40, false)}${rect(
            130,
            30,
            40,
            40,
            false
        )}`

        for (const t of [0.25, 0.5, 0.75]) {
            const [outer, ...holes] = read(morph(a, b)!(t))
            expect(holes.length).toBe(2)
            const xs = holes
                .map((hole) => centroid(hole)[0])
                .sort((x, y) => x - y)
            expect(xs[0]).toBeLessThan(80)
            expect(xs[1]).toBeGreaterThan(120)
            for (const hole of holes) {
                expect(hole.points.every((p) => inside(p, outer))).toBe(true)
                expect(crosses(hole, outer)).toBe(false)
            }
        }
    })

    test("shrinks a hole with no partner to a point", () => {
        const ring = `${circle(50, 50, 50)}${circle(50, 50, 25, 0)}`
        const disc = circle(50, 50, 50)
        const original = Math.PI * 25 * 25

        const at = (t: number) => read(morph(ring, disc)!(t))
        expect(at(0.5).length).toBe(2)

        const [outer, hole] = at(0.5)
        expect(Math.abs(area(hole)) / original).toBeCloseTo(0.25, 1)
        expect(hole.points.every((p) => inside(p, outer))).toBe(true)

        const [, closing] = at(0.99)
        expect(Math.abs(area(closing)) / original).toBeLessThan(0.01)
    })

    test("grows a new hole from a point inside the shape", () => {
        const disc = circle(50, 50, 50)
        const ring = `${circle(50, 50, 50)}${circle(30, 50, 15, 0)}`
        const final = Math.PI * 15 * 15

        for (const t of [0.05, 0.5, 0.95]) {
            const [outer, hole] = read(morph(disc, ring)!(t))
            expect(hole.points.every((p) => inside(p, outer))).toBe(true)
            expect(Math.abs(area(hole)) / final).toBeCloseTo(t * t, 1)
        }
    })

    test("keeps holes inside a shape that bends", () => {
        // A wide L whose upright swings down to the left, with a hole near
        // its tip. Moving the hole in a straight line cuts the corner.
        const l = `M0 0L100 0L100 30L30 30L30 100L0 100Z${circle(
            15,
            80,
            10,
            0
        )}`
        const bar = `M-100 0L0 0L100 0L100 30L0 30L-100 30Z${circle(
            -80,
            15,
            10,
            0
        )}`

        for (let t = 0.05; t < 1; t += 0.05) {
            const [outer, hole] = read(morph(l, bar)!(t))
            expect(hole.points.every((p) => inside(p, outer))).toBe(true)
            expect(crosses(hole, outer)).toBe(false)
        }
    })

    test("winds holes against their shape, so nonzero fills keep them open", () => {
        const ring = `${circle(50, 50, 50)}${circle(50, 50, 25, 0)}`
        const roundedRing = `${rect(0, 0, 100, 100)}${rect(
            25,
            25,
            50,
            50,
            false
        )}`
        const [outer, hole] = read(morph(ring, roundedRing)!(0.5))
        expect(Math.sign(area(outer))).toBe(-Math.sign(area(hole)))
    })

    test("shrinks subpaths with no partner to a point", () => {
        const two = `${rect(0, 0, 40, 40)}${rect(60, 0, 40, 40)}`
        const one = rect(0, 0, 40, 40)
        expect(read(morph(two, one)!(0.5)).length).toBe(2)
        const [, leaving] = read(morph(two, one)!(0.99))
        expect(Math.abs(area(leaving))).toBeLessThan(16)
    })

    test("shrinks pieces with no partner into the nearest piece, so strokes leave no dot", () => {
        const hamburger = "M20 30H80M20 50H80M20 70H80"
        const close = "M25 25L75 75M75 25L25 75"
        const check = "M30 52L45 67L72 38"
        const ring = circle(50, 50, 40)
        const pairs: [string, string, number][] = [
            [hamburger, close, 0.999],
            [close, hamburger, 0.001],
            [ring + check, check, 0.999],
            [check, ring + check, 0.001],
        ]
        for (const [from, to, t] of pairs) {
            const subpaths = read(morph(from, to)!(t))
            const speck = subpaths.find((sub) => perimeter(sub) < 1)!
            for (const p of speck.points) {
                // How far it is from the line of any other piece
                const gap = Math.min(
                    ...subpaths
                        .filter((sub) => sub !== speck)
                        .flatMap(({ points }) =>
                            points
                                .slice(1)
                                .map((q, i) => segmentDistance(p, points[i], q))
                        )
                )
                expect(gap).toBeLessThan(0.1)
            }
        }
    })

    test("morphs open paths as open paths", () => {
        const d = morph("M0 0L100 0", "M0 0Q50 100 100 0")!(0.5)
        const [line] = read(d)
        expect(line.closed).toBe(false)
        expect(distance(line.points[0], [0, 0])).toBeLessThan(5)
        expect(
            distance(line.points[line.points.length - 1], [100, 0])
        ).toBeLessThan(5)
    })

    test("flattens a wave without pinching its crests into peaks", () => {
        const wave = "M10 50C25 15 35 15 50 50S75 85 90 50"

        // How wide the first crest is, a tenth of the way down from its top
        const crest = (d: string) => {
            const points = read(d)[0].points.filter(([x]) => x < 50)
            const top = Math.min(...points.map(([, y]) => y))
            const level = top + (50 - top) / 10
            const xs: number[] = []
            for (let i = 1; i < points.length; i++) {
                const [x0, y0] = points[i - 1]
                const [x1, y1] = points[i]
                if ((y0 - level) * (y1 - level) < 0) {
                    xs.push(x0 + ((x1 - x0) * (level - y0)) / (y1 - y0))
                }
            }
            return Math.max(...xs) - Math.min(...xs)
        }

        for (const linear of [false, true]) {
            const mix = morph(wave, "M10 50H90", { linear })!
            expect(crest(mix(0.5))).toBeGreaterThan(crest(mix(0.01)) * 0.75)
        }
    })

    test("squashes a wave flat, moving each point straight to the line", () => {
        // The wave's height at x, found along whichever of its curves holds x
        const curves = [
            [10, 50, 25, 15, 35, 15, 50, 50],
            [50, 50, 65, 85, 75, 85, 90, 50],
        ]
        const cubic = (p: number[], i: number, u: number) =>
            (1 - u) ** 3 * p[i] +
            3 * (1 - u) ** 2 * u * p[i + 2] +
            3 * (1 - u) * u * u * p[i + 4] +
            u ** 3 * p[i + 6]
        const height = (x: number) => {
            const curve = curves[x < 50 ? 0 : 1]
            let low = 0
            let high = 1
            for (let k = 0; k < 40; k++) {
                const middle = (low + high) / 2
                if (cubic(curve, 0, middle) < x) low = middle
                else high = middle
            }
            return cubic(curve, 1, low)
        }

        for (const linear of [false, true]) {
            const mix = morph(
                "M10 50C25 15 35 15 50 50S75 85 90 50",
                "M10 50H90",
                { linear }
            )!
            for (const t of [0.25, 0.5, 0.75]) {
                for (const [x, y] of read(mix(t))[0].points) {
                    const squashed = 50 + (height(x) - 50) * (1 - t)
                    expect(Math.abs(y - squashed)).toBeLessThan(0.5)
                }
            }
        }
    })

    test("moves the points of a line chart straight up and down", () => {
        const a = [80, 40, 60, 20, 50, 30]
        const b = [30, 70, 20, 60, 40, 80]
        const chart = (ys: number[]) =>
            "M" + ys.map((y, i) => `${i * 20} ${y}`).join("L")

        for (const linear of [false, true]) {
            const mix = morph(chart(a), chart(b), { linear })!
            for (const t of [0.25, 0.5, 0.75]) {
                for (const [x, y] of read(mix(t))[0].points) {
                    // Each chart's line at x, between the points either side
                    const i = Math.min(Math.max(Math.floor(x / 20), 0), 4)
                    const along = (ys: number[]) =>
                        ys[i] + (ys[i + 1] - ys[i]) * (x / 20 - i)
                    const blended = along(a) + (along(b) - along(a)) * t
                    expect(Math.abs(y - blended)).toBeLessThan(0.5)
                }
            }
        }
    })

    test("continues from an interrupted morph", () => {
        const mid = morph(square, star)!(0.4)
        const next = morph(mid, circle(50, 50, 50))!
        expect(next(0)).toBe(mid)

        const [a] = read(mid)
        const [b] = read(next(0.01))
        expect(Math.abs(area(b))).toBeCloseTo(Math.abs(area(a)), -2)
        expect(distance(centroid(a), centroid(b))).toBeLessThan(2)

        // Every point starts on the interrupted outline
        const [start] = read(morph(mid, circle(50, 50, 50))!(0.0001))
        for (const p of start.points) {
            const nearest = Math.min(
                ...a.points.map((q, i) =>
                    segmentDistance(p, q, a.points[(i + 1) % a.points.length])
                )
            )
            expect(nearest).toBeLessThan(0.5)
        }
    })

    test("prepares paths drawn with hundreds of curves quickly", () => {
        const wavy = (radius: number, wave: number, phase: number) => {
            let d = ""
            for (let i = 0; i <= 400; i++) {
                const angle = (i / 400) * 2 * Math.PI
                const r = radius + wave * Math.sin(7 * angle + phase)
                const x = 50 + r * Math.cos(angle)
                const y = 50 + r * Math.sin(angle)
                d += i ? `S${x + 0.3} ${y - 0.3} ${x} ${y}` : `M${x} ${y}`
            }
            return d + "Z"
        }
        const mix = morph(wavy(40, 6, 0), wavy(30, 10, 1))!

        const start = performance.now()
        mix(0.5)
        expect(performance.now() - start).toBeLessThan(500)
    })

    test("leaves values that aren't paths to the default mixer", () => {
        expect(morph("#0077ff", "#ff0000")).toBeUndefined()
        expect(morph("none", square)).toBeUndefined()
        expect(morph(square, "10 10")).toBeUndefined()
        expect(morph(0 as any, 100 as any)).toBeUndefined()

        const matrix = ["matrix(1, 0, 0, 1, 0, 0)", "matrix(2, 0, 0, 2, 40, 0)"]
        expect(morph(matrix[0], matrix[1])).toBeUndefined()
        expect(interpolate([0, 1], matrix, { mixer: morph })(0.5)).toBe(
            interpolate([0, 1], matrix)(0.5)
        )

        const colors = interpolate([0, 1], ["#000", "#fff"], { mixer: morph })
        expect(colors(0.5)).toBe(interpolate([0, 1], ["#000", "#fff"])(0.5))
    })

    test("animates other values alongside a path with the same transition", async () => {
        const updates: number[] = []
        await animate(motionValue(0), 100, {
            mixer: morph,
            duration: 0.05,
            onUpdate: (v: number) => updates.push(v),
        })
        expect(updates.some((v) => v > 0 && v < 100)).toBe(true)
    })

    test("morphs paths that are a single point", () => {
        const pairs = [
            ["M50 50L50 50Z", square],
            [square, "M50 50L50 50Z"],
            ["M50 50L50 50", "M0 0L100 0"],
            ["M0 0L100 0", "M50 50h0"],
            // An icon's dot, drawn as a subpath of no length
            ["M12 11v6M12 7h0", "M7 12h10M7 13h10"],
            // What Motion animates from when a path has no d
            [star.replace(/\d+/g, "0"), star],
        ]
        for (const [from, to] of pairs) {
            for (const t of [0.25, 0.5, 0.75]) {
                const d = morph(from, to)!(t)
                expect(d).not.toMatch(/NaN|Infinity/)
                expect(read(d).length).toBeGreaterThan(0)
            }
        }

        const [grown] = read(morph("M50 50L50 50Z", square)!(0.5))
        expect(Math.abs(area(grown))).toBeCloseTo(2500, -2)
    })

    test("keeps the ends of open paths on the blend of their ends", () => {
        const a = "M99.6 45.7L63.9 22.6L87.5 15.3C25.4 14.9 41 48.6 12.3 94.7"
        const b =
            "M40.1 40.5L28.7 39.4C48.8 80.2 59.8 27.1 17.9 72.7C49.4 77.2 12 39.3 9.7 36.8"
        const [a0, a1]: Point[] = [
            [99.6, 45.7],
            [12.3, 94.7],
        ]
        const [b0, b1]: Point[] = [
            [40.1, 40.5],
            [9.7, 36.8],
        ]

        for (const t of [0.3, 0.5, 0.7]) {
            const { points } = read(morph(a, b)!(t))[0]
            const first = points[0]
            const last = points[points.length - 1]
            const lerp = (p: Point, q: Point): Point => [
                p[0] + (q[0] - p[0]) * t,
                p[1] + (q[1] - p[1]) * t,
            ]
            // b can run either way round
            const gap = Math.min(
                distance(first, lerp(a0, b0)) + distance(last, lerp(a1, b1)),
                distance(first, lerp(a0, b1)) + distance(last, lerp(a1, b0))
            )
            expect(gap).toBeLessThan(1)
        }
    })

    test("keeps holes that sit close to their outline at their size", () => {
        const ring = (x: number) => circle(x, 50, 50) + circle(x, 50, 48, 0)

        for (const t of [0.001, 0.5, 0.999]) {
            const [outer, hole] = read(morph(ring(50), ring(60))!(t))
            const centre: Point = [50 + 10 * t, 50]
            const radius = Math.max(
                ...hole.points.map((p) => distance(p, centre))
            )
            expect(radius).toBeCloseTo(48, 0)
            expect(crosses(hole, outer)).toBe(false)
        }
    })

    test("keeps holes inside concave outlines as they change shape", () => {
        for (const a of shapes) {
            for (const b of shapes) {
                if (a === b) continue
                const mix = morph(outlined(a, 4), outlined(b, 4))!
                for (let t = 0.05; t < 1; t += 0.05) {
                    const [outer, hole] = read(mix(t))
                    expect(hole.points.every((p) => inside(p, outer))).toBe(
                        true
                    )
                    expect(crosses(hole, outer)).toBe(false)
                }
            }
        }
    })

    test("keeps holes inside concave outlines as they open and close", () => {
        for (const shape of [L, T, plus]) {
            for (const [a, b] of [
                [outlined(shape, 4), polygon(shape)],
                [polygon(shape), outlined(shape, 4)],
            ]) {
                const mix = morph(a, b)!
                for (let t = 0.05; t < 1; t += 0.05) {
                    const [outer, hole] = read(mix(t))
                    expect(hole.points.every((p) => inside(p, outer))).toBe(
                        true
                    )
                    expect(crosses(hole, outer)).toBe(false)
                }
            }
        }
    })

    test("grows a new hole from a speck inside a small shape", () => {
        const mix = morph(
            circle(50, 50, 20),
            circle(50, 50, 50) + circle(50, 50, 5, 0)
        )!
        const [outer, hole] = read(mix(0.02))
        const [minX, maxX, minY, maxY] = span(hole)
        expect(maxX - minX).toBeLessThan(2)
        expect(maxY - minY).toBeLessThan(2)
        expect(hole.points.every((p) => inside(p, outer))).toBe(true)
    })

    test("keeps a new hole inside a thin shape as it grows", () => {
        const mix = morph(
            rect(0, 45, 100, 10),
            rect(0, 0, 100, 100) + rect(45, 45, 10, 10, false)
        )!
        for (const t of [0.02, 0.05, 0.1, 0.2]) {
            const [outer, hole] = read(mix(t))
            expect(hole.points.every((p) => inside(p, outer))).toBe(true)
        }
    })

    test("shrinks the holes of a piece that shrinks away along with it", () => {
        const ring = (x: number, r: number) =>
            circle(x, 50, r) + circle(x, 50, r * 0.6, 0)
        const mix = morph(ring(30, 25) + ring(80, 15), ring(30, 25))!
        for (const t of [0.2, 0.5, 0.8]) {
            const [, , piece, hole] = read(mix(t))
            expect(hole.points.every((p) => inside(p, piece))).toBe(true)
            const width = (sub: Subpath) => span(sub)[1] - span(sub)[0]
            expect(width(hole) / width(piece)).toBeCloseTo(0.6, 1)
        }
    })

    test("keeps a small hole small, or gone, in outlines that cross themselves on the way", () => {
        const a =
            "M84.2 54.4L42.5 80.5Q67.1 69.5 4.5 41.1L50.6 0.3Q45.1 12.8 84.2 54.4Z" +
            circle(45, 40, 4, 0)
        const b =
            "M81.7 55.7Q68.2 69.7 68.2 85.9Q66.7 9.9 39.6 84.4L21 57Q81.2 32 31.4 40.9Q93 31.1 42.1 14.3L76.8 28Q91.8 97.4 81.7 55.7Z" +
            circle(75, 45, 4, 0)
        const mix = morph(a, b)!
        for (let t = 0.05; t < 1; t += 0.05) {
            const hole: Subpath | undefined = read(mix(t))[1]
            if (!hole) continue
            const [minX, maxX, minY, maxY] = span(hole)
            expect(Math.max(maxX - minX, maxY - minY)).toBeLessThan(12)
        }
    })

    test("moves paired holes smoothly, inside their outline and turned against it", () => {
        for (const [a, b] of [
            [P, four],
            [A, bolt],
        ]) {
            const mix = morph(a, b)!
            let previous: Subpath | undefined
            for (let t = 0.005; t < 1; t += 0.005) {
                const [outer, hole] = read(mix(t))
                expect(Math.sign(area(hole))).toBe(-Math.sign(area(outer)))
                expect(hole.points.every((p) => inside(p, outer))).toBe(true)
                if (previous) {
                    const jump = Math.max(
                        ...hole.points.map((p, i) =>
                            distance(p, previous!.points[i])
                        )
                    )
                    expect(jump).toBeLessThan(5)
                }
                previous = hole
            }
        }
    })

    test("leaves holes that touch their outline where they are", () => {
        const flush = rect(0, 0, 100, 100) + rect(0, 30, 40, 40, false)
        const [, hole] = read(morph(flush, flush + " ")!(1e-9))
        for (const [x, y] of hole.points) {
            const onWindow =
                ((Math.abs(x) < 0.01 || Math.abs(x - 40) < 0.01) &&
                    y > 29.99 &&
                    y < 70.01) ||
                ((Math.abs(y - 30) < 0.01 || Math.abs(y - 70) < 0.01) &&
                    x > -0.01 &&
                    x < 40.01)
            expect(onWindow).toBe(true)
        }
    })

    test("leaves a hole under a notch where it is when nothing changes", () => {
        const notched =
            polygon([
                [0, 0],
                [45, 0],
                [50, 11.5],
                [55, 0],
                [100, 0],
                [100, 100],
                [0, 100],
            ]) + rect(8, 12, 84, 80, false)
        const [, hole] = read(morph(notched, notched + " ")!(1e-9))
        const [, , top] = span(hole)
        const lowest = Math.max(
            ...hole.points.filter(([, y]) => y < 20).map(([, y]) => y)
        )
        expect(top).toBeCloseTo(12, 1)
        expect(lowest).toBeCloseTo(12, 1)
    })

    test("keeps holes that wrap round a corner open", () => {
        // An outlined L. The middle of its hole is outside the L.
        const outlinedL = (x: number) =>
            `M${x} 0h100v20h-80v80h-20Z` + `M${x + 4} 4v92h12v-80h80v-12Z`

        for (const t of [0.25, 0.5, 0.75]) {
            const [outer, hole] = read(morph(outlinedL(0), outlinedL(10))!(t))
            expect(Math.abs(area(hole))).toBeCloseTo(2064, -2)
            expect(hole.points.every((p) => inside(p, outer))).toBe(true)
            expect(crosses(hole, outer)).toBe(false)
        }
    })

    test("never draws a hole outside its outline, though its partner is across a gap", () => {
        // A U with a hole in each arm. Straight across, a hole would pass
        // through the gap between them.
        const u = "M0 0H30V70H70V0H100V100H0Z"
        const mix = morph(
            u + rect(10, 20, 10, 10, false),
            u + rect(80, 20, 10, 10, false)
        )!
        for (let t = 0.01; t < 1; t += 0.01) {
            const [outer, ...holes] = read(mix(t))
            for (const hole of holes) {
                expect(hole.points.every((p) => inside(p, outer))).toBe(true)
                expect(crosses(hole, outer)).toBe(false)
            }
        }
    })

    test("grows and shrinks holes only where their outline is closed round them", () => {
        const u =
            "M10 0H35V60C35 70 42 75 50 75C58 75 65 70 65 60V0H90V60C90 85 72 100 50 100C28 100 10 85 10 60Z"
        const c =
            "M85 25C77 12 64 5 50 5C25 5 5 25 5 50C5 75 25 95 50 95C64 95 77 88 85 75L65 62C61 70 56 73 50 73C37 73 27 63 27 50C27 37 37 27 50 27C56 27 61 30 65 38Z"
        const o = circle(50, 50, 45) + circle(50, 50, 25, 0)
        for (const [a, b] of [
            [u, o],
            [o, u],
            [c, o],
            [o, c],
        ]) {
            const mix = morph(a, b)!
            for (let t = 0.01; t < 1; t += 0.01) {
                const [outer, ...holes] = read(mix(t))
                for (const hole of holes) {
                    expect(hole.points.every((p) => inside(p, outer))).toBe(
                        true
                    )
                    expect(crosses(hole, outer)).toBe(false)
                }
            }
        }
    })

    test("keeps paired holes at least half as far from their outline as an even blend of their ends", () => {
        for (const [a, b] of [
            [P, four],
            [A, bolt],
        ]) {
            const mix = morph(a, b)!
            const [outerA, holeA] = read(mix(1e-9))
            const [outerB, holeB] = read(mix(1 - 1e-9))
            const gapA = clearance(holeA, outerA)
            const gapB = clearance(holeB, outerB)
            for (let t = 0.02; t < 1; t += 0.02) {
                const [outer, hole] = read(mix(t))
                expect(clearance(hole, outer)).toBeGreaterThan(
                    0.49 * (gapA + (gapB - gapA) * t)
                )
            }
        }
    })

    test("shrinks holes smoothly as they pass a corner of their outline", () => {
        // Outlined Ls, whose holes turn into a bar along the bottom, or the
        // hole of an outlined 7
        const l = "M0 0H30V70H100V100H0Z"
        const lHole = "M6 94L94 94L94 76L24 76L24 6L6 6Z"
        const seven =
            "M0 0L100 0L100 25L55 100L25 100L68 25L0 25Z" +
            "M6 19L78.356 19L35.356 94L51.603 94L94 23.338L94 6L6 6Z"
        for (const [a, b] of [
            [l + lHole, l + "M40 92L94 92L94 78L40 78Z"],
            [l + lHole, seven],
        ]) {
            const mix = morph(a, b)!
            let previous: Subpath | undefined
            for (let t = 0.002; t < 1; t += 0.002) {
                const hole: Subpath | undefined = read(mix(t))[1]
                if (previous && hole) {
                    const jump = Math.max(
                        ...hole.points.map((p, i) =>
                            distance(p, previous!.points[i])
                        )
                    )
                    expect(jump).toBeLessThan(2)
                }
                previous = hole
            }
        }
    })

    test("keeps outlines that cross themselves on the way near their size", () => {
        const a =
            "M84.2 54.4L42.5 80.5Q67.1 69.5 4.5 41.1L50.6 0.3Q45.1 12.8 84.2 54.4Z"
        const b =
            "M81.7 55.7Q68.2 69.7 68.2 85.9Q66.7 9.9 39.6 84.4L21 57Q81.2 32 31.4 40.9Q93 31.1 42.1 14.3L76.8 28Q91.8 97.4 81.7 55.7Z"

        for (let t = 0.05; t < 1; t += 0.05) {
            for (const [x, y] of read(morph(a, b)!(t))[0].points) {
                expect(Math.abs(x - 50)).toBeLessThan(100)
                expect(Math.abs(y - 50)).toBeLessThan(100)
            }
        }
    })

    test("keeps new holes open when the shapes wind different ways", () => {
        const disc = circle(50, 50, 50, 0)
        const ring = `${circle(50, 50, 50)}${circle(30, 50, 15, 0)}`
        for (const t of [0.25, 0.5, 0.75]) {
            const [outer, hole] = read(morph(disc, ring)!(t))
            expect(Math.sign(area(hole))).toBe(-Math.sign(area(outer)))
        }
    })

    test("winds new pieces like the pieces they appear beside", () => {
        // Two bars that overlap, drawn the other way round to the disc
        const disc = circle(50, 50, 50)
        const plus = rect(35, 0, 30, 100, false) + rect(0, 35, 100, 30, false)
        for (const t of [0.25, 0.5, 0.75]) {
            const [first, second] = read(morph(disc, plus)!(t))
            expect(Math.sign(area(second))).toBe(Math.sign(area(first)))
        }
    })

    test("keeps contours inside a shape that wind the same way as it", () => {
        // With the default nonzero fill rule, these are solid discs
        const solid = circle(50, 50, 50) + circle(50, 50, 25)
        const solidSquare = rect(0, 0, 100, 100) + rect(25, 25, 50, 50)
        const [outer, inner] = read(morph(solid, solidSquare)!(0.5))
        expect(Math.sign(area(inner))).toBe(Math.sign(area(outer)))
    })

    test("writes large shapes in whole numbers", () => {
        const d = morph("M0 0H1e9V1e9H0Z", "M0 0L5e8 1e9L1e9 0Z")!(0.5)
        expect(d).toMatch(/^M[-\d ]+Z$/)
    })

    test("stops reading a path at a number too large to draw", () => {
        const d = morph("M0 0L1e400 0L50 50Z", square)!(0.5)
        expect(d).not.toMatch(/NaN|Infinity/)
    })

    test("falls back to switching when a path can't be read", () => {
        const mix = morph("M", square)!
        expect(mix(0)).toBe("M")
        expect(mix(0.5)).toBe(square)
        expect(mix(1)).toBe(square)
    })

    test("works as an interpolate mixer", () => {
        const output = interpolate([0, 1, 2], [square, star, square], {
            mixer: morph,
        })
        expect(output(1)).toBe(star)
        expect(read(output(0.5))[0].points.length).toBeGreaterThan(10)

        const transformed = transform(0.5, [0, 1], [square, star], {
            mixer: morph,
        })
        expect(read(transformed)[0].points.length).toBeGreaterThan(10)
    })

    test("animates an SVG path with transition.mixer", async () => {
        const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
        )
        path.setAttribute("d", square)
        const updates: string[] = []

        await animate(
            path,
            { d: star },
            {
                mixer: morph,
                duration: 0.05,
                onUpdate: (d: string) => updates.push(d),
            }
        )

        expect(updates.some((d) => d !== square && d !== star)).toBe(true)
        expect(path.getAttribute("d")).toBe(star)
    })
})
