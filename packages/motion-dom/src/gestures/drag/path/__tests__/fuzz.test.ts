import { createPathSolver, createRing, type Ring } from "../solver"

type P = { x: number; y: number }

// Deterministic PRNG
let seed = 1
const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
}

const ring = (points: P[], closed = true) =>
    createRing(
        points.flatMap(({ x, y }) => [x, y]),
        closed
    )

const box = (x: number, y: number, w: number, h: number) =>
    ring([
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
    ])

function inside(r: Ring, { x, y }: P) {
    let c = false
    const p = r.points
    for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i],
            ay = p[i + 1],
            bx = p[i + 2],
            by = p[i + 3]
        if (ay > y !== by > y && x < ax + ((y - ay) * (bx - ax)) / (by - ay))
            c = !c
    }
    return c
}
function distTo(r: Ring, { x, y }: P) {
    let best = Infinity
    const p = r.points
    for (let i = 0; i < p.length - 2; i += 2) {
        const ax = p[i],
            ay = p[i + 1],
            dx = p[i + 2] - ax,
            dy = p[i + 3] - ay
        const l = dx * dx + dy * dy
        const t = l
            ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l))
            : 0
        best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
    }
    return best
}
const inRoom = (r: Ring, p: P) => inside(r, p) || distTo(r, p) < 1e-6

describe("fuzz: never leaves its room", () => {
    for (const gap of [0.01, 0.5, 2, 10]) {
        test(`two rooms ${gap}px apart`, () => {
            seed = 42
            let failures = 0
            let first: string | undefined
            for (let trial = 0; trial < 300; trial++) {
                const a = box(0, 0, 100, 100)
                const b = box(100 + gap, 0, 100, 100)
                const solve = createPathSolver(
                    [a, b],
                    { x: 50, y: 50 },
                    false,
                    20 + rand() * 40
                )
                for (let k = 0; k < 40; k++) {
                    const target = {
                        x: -50 + rand() * 300,
                        y: -50 + rand() * 200,
                    }
                    const p = solve(target, rand() < 0.3 ? 0 : undefined)
                    if (!inRoom(a, p)) {
                        failures++
                        first ??= JSON.stringify({ trial, k, target, p })
                        break
                    }
                }
            }
            expect(first).toBeUndefined()
            expect(failures).toBe(0)
        })
    }

    test("stroke: two parallel lines 1px apart", () => {
        seed = 7
        let first: string | undefined
        for (let trial = 0; trial < 300 && !first; trial++) {
            const a = ring(
                [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                ],
                false
            )
            const b = ring(
                [
                    { x: 0, y: 1 },
                    { x: 100, y: 1 },
                ],
                false
            )
            const solve = createPathSolver([a, b], { x: 50, y: 0 }, true, 40)
            for (let k = 0; k < 40; k++) {
                const target = { x: -50 + rand() * 200, y: -50 + rand() * 100 }
                const p = solve(target)
                if (Math.abs(p.y) > 1e-9) {
                    first = JSON.stringify({ trial, k, target, p })
                    break
                }
            }
        }
        expect(first).toBeUndefined()
    })

    test("random star polygons: stays inside or on the edge", () => {
        seed = 3
        let first: string | undefined
        for (let trial = 0; trial < 200 && !first; trial++) {
            const n = 5 + Math.floor(rand() * 20)
            const pts: P[] = []
            for (let i = 0; i < n; i++) {
                const angle = (i / n) * Math.PI * 2
                const r = 10 + rand() * 90
                pts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
            }
            const a = ring(pts)
            const solve = createPathSolver(
                [a],
                { x: 0, y: 0 },
                false,
                rand() * 60
            )
            for (let k = 0; k < 60; k++) {
                const target = {
                    x: -150 + rand() * 300,
                    y: -150 + rand() * 300,
                }
                const p = solve(target, rand() < 0.3 ? 0 : undefined)
                if (!inRoom(a, p) || !isFinite(p.x) || !isFinite(p.y)) {
                    first = JSON.stringify({
                        trial,
                        k,
                        target,
                        p,
                        d: distTo(a, p),
                    })
                    break
                }
            }
        }
        expect(first).toBeUndefined()
    })

    test("random small steps in a star polygon: never jumps across the outside", () => {
        // A thin-walled comb: rooms joined only at the bottom
        seed = 11
        const comb: P[] = [{ x: 0, y: 20 }]
        for (let i = 0; i < 10; i++) {
            if (i) comb.push({ x: i * 20, y: 0 })
            comb.push({ x: i * 20, y: -100 })
            comb.push({ x: i * 20 + 18, y: -100 })
            comb.push({ x: i * 20 + 18, y: 0 })
        }
        comb.push({ x: 198, y: 20 })
        let first: string | undefined
        for (let trial = 0; trial < 200 && !first; trial++) {
            const tooth = Math.floor(rand() * 10)
            const solve = createPathSolver(
                [ring(comb)],
                { x: tooth * 20 + 9, y: -90 },
                false,
                20
            )
            let p: P = { x: tooth * 20 + 9, y: -90 }
            for (let k = 0; k < 30; k++) {
                // Stay high: the pointer never visits the bottom bar, so the
                // element must never change tooth (it'd need to go via y > 0
                // and back up, and forgiveness is 20)
                const target = { x: rand() * 200, y: -100 + rand() * 60 }
                p = solve(target)
                const t = Math.floor(p.x / 20)
                const onTooth =
                    p.x >= tooth * 20 - 1e-6 && p.x <= tooth * 20 + 18 + 1e-6
                if (!onTooth) {
                    first = JSON.stringify({ trial, k, tooth, t, target, p })
                    break
                }
            }
        }
        expect(first).toBeUndefined()
    })
})

describe("fuzz: holes", () => {
    test("never ends inside a hole, small and large steps", () => {
        seed = 99
        let first: string | undefined
        for (let trial = 0; trial < 200 && !first; trial++) {
            const outer = box(0, 0, 200, 200)
            const holes: Ring[] = []
            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 4; j++) {
                    const w = 2 + rand() * 30
                    const h = 2 + rand() * 30
                    holes.push(box(10 + i * 48, 10 + j * 48, w, h))
                }
            }
            const rings = [outer, ...holes]
            const solve = createPathSolver(
                rings,
                { x: 5, y: 5 },
                false,
                rand() * 40,
                true
            )
            let p: P = { x: 5, y: 5 }
            for (let k = 0; k < 80; k++) {
                const big = rand() < 0.5
                const target = big
                    ? { x: rand() * 220 - 10, y: rand() * 220 - 10 }
                    : {
                          x: p.x + (rand() - 0.5) * 6,
                          y: p.y + (rand() - 0.5) * 6,
                      }
                p = solve(target, rand() < 0.3 ? 0 : undefined)
                const bad =
                    !inRoom(outer, p) ||
                    holes.some(
                        (hole) => inside(hole, p) && distTo(hole, p) > 1e-6
                    ) ||
                    !isFinite(p.x)
                if (bad) {
                    first = JSON.stringify({ trial, k, target, p })
                    break
                }
            }
        }
        expect(first).toBeUndefined()
    })
})

describe("fuzz: overlapping subpaths", () => {
    test("never leaves the union of rects that overlap (nonzero)", () => {
        seed = 7
        let first: string | undefined
        for (let trial = 0; trial < 200 && !first; trial++) {
            // A chain of rects, each overlapping the last
            const rects: Ring[] = []
            let x = 0
            let y = 0
            for (let i = 0; i < 5; i++) {
                const w = 20 + rand() * 40
                const h = 20 + rand() * 40
                rects.push(box(x, y, w, h))
                x += w * (0.3 + rand() * 0.5)
                y += h * (rand() - 0.5)
            }
            const start = { x: 5, y: 5 }
            const solve = createPathSolver(rects, start, false, rand() * 40)
            let p: P = start
            for (let k = 0; k < 80; k++) {
                const target =
                    rand() < 0.5
                        ? { x: rand() * 250 - 20, y: rand() * 150 - 60 }
                        : {
                              x: p.x + (rand() - 0.5) * 10,
                              y: p.y + (rand() - 0.5) * 10,
                          }
                p = solve(target, rand() < 0.3 ? 0 : undefined)
                if (!rects.some((r) => inRoom(r, p)) || !isFinite(p.x)) {
                    first = JSON.stringify({ trial, k, target, p })
                    break
                }
            }
        }
        expect(first).toBeUndefined()
    })
})
