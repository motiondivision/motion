import {
    animate,
    interpolate,
    motionValue,
    transform,
} from "framer-motion/dom"
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
              Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)
          )
        : 0
    return distance(p, [a[0] + t * dx, a[1] + t * dy])
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


const circle = (cx: number, cy: number, r: number, sweep = 1) =>
    `M${cx - r} ${cy}A${r} ${r} 0 1 ${sweep} ${cx + r} ${cy}A${r} ${r} 0 1 ${sweep} ${
        cx - r
    } ${cy}Z`

const rect = (x: number, y: number, w: number, h: number, clockwise = true) =>
    clockwise
        ? `M${x} ${y}H${x + w}V${y + h}H${x}Z`
        : `M${x} ${y}V${y + h}H${x + w}V${y}Z`

const square = rect(0, 0, 100, 100)
const star =
    "M50 0L61 35L98 35L68 57L79 91L50 70L21 91L32 57L2 35L39 35Z"

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
                for (const q of points) longest = Math.max(longest, distance(p, q))
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
        const b = `${circle(100, 50, 100)}${rect(
            30,
            30,
            40,
            40,
            false
        )}${rect(130, 30, 40, 40, false)}`

        for (const t of [0.25, 0.5, 0.75]) {
            const [outer, ...holes] = read(morph(a, b)!(t))
            expect(holes.length).toBe(2)
            const xs = holes.map((hole) => centroid(hole)[0]).sort((x, y) => x - y)
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
        const l = `M0 0L100 0L100 30L30 30L30 100L0 100Z${circle(15, 80, 10, 0)}`
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
        const roundedRing = `${rect(0, 0, 100, 100)}${rect(25, 25, 50, 50, false)}`
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

    test("morphs open paths as open paths", () => {
        const d = morph("M0 0L100 0", "M0 0Q50 100 100 0")!(0.5)
        const [line] = read(d)
        expect(line.closed).toBe(false)
        expect(distance(line.points[0], [0, 0])).toBeLessThan(5)
        expect(
            distance(line.points[line.points.length - 1], [100, 0])
        ).toBeLessThan(5)
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
            const radius = Math.max(...hole.points.map((p) => distance(p, centre)))
            expect(radius).toBeCloseTo(48, 0)
            expect(crosses(hole, outer)).toBe(false)
        }
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
