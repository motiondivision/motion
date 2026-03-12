import { mixAxisDelta } from "../create-projection-node"
import type { AxisDelta } from "motion-utils"

function makeAxisDelta(
    translate: number,
    scale = 1,
    origin = 0,
    originPoint = 0
): AxisDelta {
    return { translate, scale, origin, originPoint }
}

describe("mixAxisDelta", () => {
    test("at progress 0 returns origin translate", () => {
        const output = makeAxisDelta(0)
        mixAxisDelta(output, makeAxisDelta(-300), -150, 0)
        expect(output.translate).toBeCloseTo(-300)
        expect(output.scale).toBeCloseTo(1)
    })

    test("at progress 1 returns target translate (0) and scale (1)", () => {
        const output = makeAxisDelta(0)
        mixAxisDelta(output, makeAxisDelta(-300, 0.5), -150, 1)
        expect(output.translate).toBeCloseTo(0)
        expect(output.scale).toBeCloseTo(1)
    })

    test("at progress 0.5 with on-axis control, matches quadratic Bezier midpoint", () => {
        const output = makeAxisDelta(0)
        // bezierPoint(0.5, -300, -150, 0)
        // = 0.25 * -300 + 0.5 * -150 + 0 = -75 + -75 = -150
        mixAxisDelta(output, makeAxisDelta(-300), -150, 0.5)
        expect(output.translate).toBeCloseTo(-150)
    })

    test("off-axis control creates perpendicular displacement at midpoint", () => {
        const output = makeAxisDelta(0)
        // delta.translate=0 (no movement on this axis), control=-300 creates arc
        // bezierPoint(0.5, 0, -300, 0) = 0 + 0.5 * -300 + 0 = -150
        mixAxisDelta(output, makeAxisDelta(0), -300, 0.5)
        expect(output.translate).toBeCloseTo(-150)
    })

    test("off-axis control gives zero deviation at endpoints", () => {
        const output = makeAxisDelta(0)
        mixAxisDelta(output, makeAxisDelta(0), -300, 0)
        expect(output.translate).toBeCloseTo(0)

        mixAxisDelta(output, makeAxisDelta(0), -300, 1)
        expect(output.translate).toBeCloseTo(0)
    })

    test("preserves origin and originPoint from delta", () => {
        const delta = makeAxisDelta(-300, 1, 0.5, 150)
        const output = makeAxisDelta(0)
        mixAxisDelta(output, delta, 0, 0.5)
        expect(output.origin).toBe(0.5)
        expect(output.originPoint).toBe(150)
    })
})
