import { flattenPath } from "../parse"

function hasPoint(points: number[], x: number, y: number) {
    for (let i = 0; i < points.length; i += 2) {
        if (
            Math.abs(points[i] - x) < 1e-6 &&
            Math.abs(points[i + 1] - y) < 1e-6
        ) {
            return true
        }
    }
    return false
}

describe("flattenPath", () => {
    test("lines, closed by Z", () => {
        expect(flattenPath("M0 0 L10 0 L10 10 Z", 1)).toEqual([
            [[0, 0, 10, 0, 10, 10, 0, 0], true],
        ])
    })

    test("relative commands and the lines implied after a move", () => {
        expect(flattenPath("m10 10 20 0 0 20z", 1)).toEqual([
            [[10, 10, 30, 10, 30, 30, 10, 10], true],
        ])
    })

    test("horizontal and vertical lines", () => {
        expect(flattenPath("M0 0 H10 V5 h-10 v-5", 1)).toEqual([
            [[0, 0, 10, 0, 10, 5, 0, 5, 0, 0], false],
        ])
    })

    test("splits subpaths", () => {
        expect(flattenPath("M0 0 L1 0 M5 5 L6 5", 1)).toEqual([
            [[0, 0, 1, 0], false],
            [[5, 5, 6, 5], false],
        ])
    })

    test("a subpath after Z starts where the last one did", () => {
        expect(flattenPath("M5 5 L10 5 Z l0 10", 1)).toEqual([
            [[5, 5, 10, 5, 5, 5], true],
            [[5, 5, 5, 15], false],
        ])
    })

    test("exponents", () => {
        expect(flattenPath("M1e1 0 L2e1 0", 1)).toEqual([
            [[10, 0, 20, 0], false],
        ])
    })

    test("cubic curves, in steps", () => {
        const [[points]] = flattenPath("M0 0 C0 10 10 10 10 0", 1)
        expect(points.length / 2 - 1).toBe(30)
        expect(hasPoint(points, 5, 7.5)).toBe(true)
        expect(hasPoint(points, 10, 0)).toBe(true)
    })

    test("smooth cubics reflect the last control point", () => {
        const [[points]] = flattenPath("M0 0 C0 10 10 10 10 0 S20 -10 20 0", 1)
        expect(hasPoint(points, 15, -7.5)).toBe(true)
    })

    test("quadratic curves, smooth ones reflecting their control point", () => {
        const [[points]] = flattenPath("M0 0 Q5 10 10 0 T20 0", 1)
        const ys = points.filter((_, i) => i % 2)
        // Peaks of 5 halfway along each, the second flipped
        expect(Math.max(...ys)).toBeCloseTo(5, 1)
        expect(Math.min(...ys)).toBeCloseTo(-5, 1)
    })

    test("arcs", () => {
        const [[points]] = flattenPath("M0 0 A10 10 0 0 1 20 0", 1)
        for (let i = 0; i < points.length; i += 2) {
            expect(Math.hypot(points[i] - 10, points[i + 1])).toBeCloseTo(10, 6)
        }
        // Sweeping clockwise on screen, over the top
        expect(Math.min(...points.filter((_, i) => i % 2))).toBeCloseTo(-10, 1)
        expect(points.slice(-2)).toEqual([20, 0])
    })

    test("arc flags written without separators", () => {
        expect(flattenPath("M0 0a10 10 0 0120 0", 1)).toEqual(
            flattenPath("M0 0 a10 10 0 0 1 20 0", 1)
        )
    })

    test("scales up arc radii too small to reach the endpoint", () => {
        expect(flattenPath("M0 0 A1 1 0 0 1 20 0", 1)[0][0]).toEqual(
            flattenPath("M0 0 A10 10 0 0 1 20 0", 1)[0][0]
        )
    })

    test("stops at unreadable data", () => {
        expect(flattenPath("M0 0 L10 0 X 5 5", 1)).toEqual([
            [[0, 0, 10, 0], false],
        ])
    })
})
