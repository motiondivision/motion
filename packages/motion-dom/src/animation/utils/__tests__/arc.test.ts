import { arc } from "../arc"

describe("arc()", () => {
    test("returns the from point at t=0 and to point at t=1", () => {
        const interp = arc({ amplitude: 1 })({ x: 0, y: 0 }, { x: 200, y: 0 })
        const start = interp(0)
        const end = interp(1)
        expect(start.x).toBeCloseTo(0)
        expect(start.y).toBeCloseTo(0)
        expect(end.x).toBeCloseTo(200)
        expect(end.y).toBeCloseTo(0)
    })

    test("amplitude=1 horizontal: bulges perpendicular by ~half travel at t=0.5", () => {
        // bezier midpoint perpendicular component = control.y / 2 = 200/2 = 100
        const interp = arc({ amplitude: 1 })({ x: 0, y: 0 }, { x: 200, y: 0 })
        const mid = interp(0.5)
        expect(mid.x).toBeCloseTo(100)
        expect(Math.abs(mid.y)).toBeCloseTo(100)
    })

    test("amplitude=0 produces straight line at midpoint", () => {
        const interp = arc({ amplitude: 0 })({ x: 0, y: 0 }, { x: 200, y: 100 })
        const mid = interp(0.5)
        expect(mid.x).toBeCloseTo(100)
        expect(mid.y).toBeCloseTo(50)
    })

    test("default amplitude (no options) produces a curve", () => {
        const interp = arc()({ x: 0, y: 0 }, { x: 200, y: 0 })
        expect(Math.abs(interp(0.5).y)).toBeGreaterThan(0)
    })

    test("direction='cw' bulges opposite side from 'ccw'", () => {
        const cw = arc({ amplitude: 1, direction: "cw" })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )(0.5)
        const ccw = arc({ amplitude: 1, direction: "ccw" })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )(0.5)
        expect(Math.sign(cw.y)).toBe(-Math.sign(ccw.y))
    })

    test("auto direction: same screen side regardless of travel direction", () => {
        // Moving right then left should both bulge to the same screen-y side.
        const right = arc({ amplitude: 1 })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )(0.5)
        const left = arc({ amplitude: 1 })(
            { x: 200, y: 0 },
            { x: 0, y: 0 }
        )(0.5)
        expect(Math.sign(right.y)).toBe(Math.sign(left.y))
    })

    test("peak shifts the control point along the chord", () => {
        // For a horizontal chord, peak shifts where x hits its midpoint —
        // earlier peak pulls x ahead at t=0.5, later peak holds it back.
        const early = arc({ amplitude: 1, peak: 0.2 })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )(0.5)
        const late = arc({ amplitude: 1, peak: 0.8 })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )(0.5)
        expect(early.x).toBeLessThan(late.x)
    })

    test("orientToPath false omits rotate", () => {
        const interp = arc({ amplitude: 1 })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )
        expect(interp(0.5).rotate).toBeUndefined()
    })

    test("orientToPath true returns rotate values along the curve", () => {
        const interp = arc({ amplitude: 1, orientToPath: true })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )
        expect(interp(0.5).rotate).toBeDefined()
        // Rotation is normalized to 0 at endpoints
        expect(interp(0).rotate).toBeCloseTo(0)
        expect(interp(1).rotate).toBeCloseTo(0)
    })

    test("orientToPath number scales rotation intensity", () => {
        const full = arc({ amplitude: 1, orientToPath: 1 })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )(0.25)
        const half = arc({ amplitude: 1, orientToPath: 0.5 })(
            { x: 0, y: 0 },
            { x: 200, y: 0 }
        )(0.25)
        expect(Math.abs(half.rotate!)).toBeCloseTo(Math.abs(full.rotate!) * 0.5)
    })

    test("clean reversal naturally bulges the same screen side (auto-direction)", () => {
        // No factory state needed — auto-direction's flip cancels the
        // perpendicular flip when the chord reverses cleanly.
        const a1 = arc({ amplitude: 1 })
        const a2 = arc({ amplitude: 1 })
        const first = a1({ x: 0, y: 0 }, { x: 200, y: 0 })(0.5)
        const second = a2({ x: 200, y: 0 }, { x: 0, y: 0 })(0.5)
        expect(Math.sign(first.y)).toBe(Math.sign(second.y))
    })

    test("dominant-axis change keeps bulging same side when factory is reused", () => {
        // Arc 1: mostly horizontal — auto-direction picks +y bulge (down).
        // Arc 2 from arc 1's apex toward a mostly-vertical chord —
        // auto-direction alone would pick a different screen side.
        // Reusing the factory closes over prevBulgeSign and forces same side.
        const a = arc({ amplitude: 1 })
        const apex = a({ x: 0, y: 0 }, { x: 300, y: 50 })(0.5)
        // Apex.y > 25 (chord midpoint y) means arc 1 bulged down.
        expect(apex.y).toBeGreaterThan(25)

        const second = a({ x: apex.x, y: apex.y }, { x: 50, y: 300 })(0.5)
        // For arc 2's mostly-vertical chord, "same screen side as down" means
        // the bulge sign in x is on the side that keeps screen-y monotone-ish.
        // Concretely: arc 2 should not invert direction relative to apex's y.
        expect(second.y).toBeGreaterThan(apex.y)
    })

    test("fresh factory per call has no memory (documented limitation)", () => {
        // Two unrelated factories — the dominant-axis-change continuity
        // feature only fires when the same factory is reused.
        const apex = arc({ amplitude: 1 })({ x: 0, y: 0 }, { x: 300, y: 50 })(0.5)
        const second = arc({ amplitude: 1 })(
            { x: apex.x, y: apex.y },
            { x: 50, y: 300 }
        )(0.5)
        // Without shared state, behavior is purely auto-direction.
        // We don't assert a specific direction here — just that this
        // codepath runs without throwing.
        expect(typeof second.x).toBe("number")
        expect(typeof second.y).toBe("number")
    })

    test("zero distance yields a no-op interpolator", () => {
        const interp = arc({ amplitude: 1 })({ x: 5, y: 10 }, { x: 5, y: 10 })
        const mid = interp(0.5)
        expect(mid.x).toBeCloseTo(5)
        expect(mid.y).toBeCloseTo(10)
    })
})
