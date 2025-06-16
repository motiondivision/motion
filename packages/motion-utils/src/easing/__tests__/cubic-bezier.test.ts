import { cubicBezier } from "../cubic-bezier"

describe("cubicBezier", () => {
    test("correctly generates easing functions from curve definitions", () => {
        const linear = cubicBezier(0, 0, 1, 1)
        expect(linear(0)).toBe(0)
        expect(linear(1)).toBe(1)
        expect(linear(0.5)).toBe(0.5)

        const curve = cubicBezier(0.5, 0.1, 0.31, 0.96)
        expect(curve(0)).toBe(0)
        expect(curve(0.01)).toBeCloseTo(0.002, 2)
        expect(curve(0.25)).toBeCloseTo(0.164, 2)
        expect(curve(0.75)).toBeCloseTo(0.935, 2)
        expect(curve(0.99)).toBeCloseTo(0.999, 2)
        expect(curve(1)).toBe(1)
    })
})
