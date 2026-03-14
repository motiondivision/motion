import {
    bezierPoint,
    bezierTangentAngle,
    computeArcControlPoint,
    resolveArcAmplitude,
} from "../arc"

describe("bezierPoint", () => {
    test("at t=0 returns origin", () => {
        expect(bezierPoint(0, -200, 0, 200)).toBeCloseTo(-200)
    })

    test("at t=1 returns target", () => {
        expect(bezierPoint(1, -200, 0, 200)).toBeCloseTo(200)
    })

    test("at t=0.5 with control at midpoint matches linear midpoint", () => {
        // bezierPoint(0.5, -200, 0, 200): control=0 is the midpoint of -200…200
        // = 0.25*-200 + 0.5*0 + 0.25*200 = -50 + 0 + 50 = 0
        expect(bezierPoint(0.5, -200, 0, 200)).toBeCloseTo(0)
    })

    test("off-axis control produces arc deviation at midpoint", () => {
        // delta.y = 0 (no movement), control displaced to 400
        // bezierPoint(0.5, 0, 400, 0) = 0 + 0.5*400 + 0 = 200
        expect(bezierPoint(0.5, 0, 400, 0)).toBeCloseTo(200)
    })

    test("returns exact endpoints regardless of control value", () => {
        const control = 999
        expect(bezierPoint(0, 10, control, 90)).toBeCloseTo(10)
        expect(bezierPoint(1, 10, control, 90)).toBeCloseTo(90)
    })
})

describe("computeArcControlPoint", () => {
    test("horizontal movement: control perpendicular (downward for amplitude=1)", () => {
        // from=(0,0) to=(100,0): perpendicular is downward (+y)
        // mid=(50,0), desiredHeight=100, control=(50, 100)
        const cp = computeArcControlPoint(0, 0, 100, 0, 1, 0.5)
        expect(cp.x).toBeCloseTo(50)
        expect(cp.y).toBeCloseTo(100)
    })

    test("negative amplitude flips perpendicular direction (upward)", () => {
        const cp = computeArcControlPoint(0, 0, 100, 0, -1, 0.5)
        expect(cp.x).toBeCloseTo(50)
        expect(cp.y).toBeCloseTo(-100)
    })

    test("vertical movement: control perpendicular (leftward for amplitude=1)", () => {
        // from=(0,0) to=(0,100): perpendicular(-deltaY, deltaX) = (-1, 0) = leftward
        // mid=(0,50), desiredHeight=100, control=(-100, 50)
        const cp = computeArcControlPoint(0, 0, 0, 100, 1, 0.5)
        expect(cp.x).toBeCloseTo(-100)
        expect(cp.y).toBeCloseTo(50)
    })

    test("asymmetric peak shifts control point along the path", () => {
        // peak=0.2 means control point is 20% along path, not 50%
        const cpEarly = computeArcControlPoint(0, 0, 100, 0, 1, 0.2)
        const cpDefault = computeArcControlPoint(0, 0, 100, 0, 1, 0.5)
        expect(cpEarly.x).toBeCloseTo(20)
        expect(cpDefault.x).toBeCloseTo(50)
        // perpendicular component is the same
        expect(cpEarly.y).toBeCloseTo(100)
        expect(cpDefault.y).toBeCloseTo(100)
    })

    test("zero distance returns the from point", () => {
        const cp = computeArcControlPoint(5, 10, 5, 10, 1, 0.5)
        expect(cp.x).toBe(5)
        expect(cp.y).toBe(10)
    })

    test("diagonal movement produces correct control point", () => {
        // from=(0,0) to=(100,100): distance=√2*100≈141.4
        // perpendicular to (100,100) is (-100,100), normalized: (-1/√2, 1/√2)
        // mid=(50,50), desiredHeight=1*141.4≈141.4
        // control=(50 + (-1/√2)*141.4, 50 + (1/√2)*141.4) = (50-100, 50+100) = (-50, 150)
        const cp = computeArcControlPoint(0, 0, 100, 100, 1, 0.5)
        expect(cp.x).toBeCloseTo(-50, 0)
        expect(cp.y).toBeCloseTo(150, 0)
    })
})

describe("bezierTangentAngle", () => {
    test("horizontal line returns 0°", () => {
        // from=(0,0) control=(50,0) to=(100,0) — straight horizontal
        expect(bezierTangentAngle(0.5, 0, 50, 100, 0, 0, 0)).toBeCloseTo(0)
    })

    test("vertical line returns 90°", () => {
        // from=(0,0) control=(0,50) to=(0,100) — straight vertical
        expect(bezierTangentAngle(0.5, 0, 0, 0, 0, 50, 100)).toBeCloseTo(90)
    })

    test("t=0 with arc reflects initial tangent direction", () => {
        // Horizontal path with downward arc: from=(0,0) control=(50,100) to=(100,0)
        // At t=0: dx=2*(control.x-origin.x)=100, dy=2*(control.y-origin.y)=200
        // angle = atan2(200,100) ≈ 63.43°
        const angle = bezierTangentAngle(0, 0, 50, 100, 0, 100, 0)
        expect(angle).toBeCloseTo(63.43, 0)
    })

    test("t=0.5 with symmetric arc is parallel to chord", () => {
        // Symmetric arc: from=(0,0) control=(50,100) to=(100,0)
        // At t=0.5: dx=(50-0)+(100-50)=100, dy=(100-0)+(0-100)=0 → 0°
        expect(bezierTangentAngle(0.5, 0, 50, 100, 0, 100, 0)).toBeCloseTo(0)
    })

    test("zero-length path returns 0°", () => {
        expect(bezierTangentAngle(0.5, 5, 5, 5, 10, 10, 10)).toBeCloseTo(0)
    })
})

describe("resolveArcAmplitude", () => {
    test("direction='ccw' keeps amplitude positive", () => {
        expect(resolveArcAmplitude({ amplitude: 1, direction: "ccw" }, 100, 0)).toBe(1)
        expect(resolveArcAmplitude({ amplitude: 1, direction: "ccw" }, -100, 0)).toBe(1)
    })

    test("direction='cw' negates amplitude", () => {
        expect(resolveArcAmplitude({ amplitude: 1, direction: "cw" }, 100, 0)).toBe(-1)
        expect(resolveArcAmplitude({ amplitude: 0.5, direction: "cw" }, -100, 0)).toBeCloseTo(-0.5)
    })

    test("auto: positive dominant x delta keeps amplitude", () => {
        // Moving right: deltaX=400, auto → dominantDelta=400 > 0 → no flip
        expect(resolveArcAmplitude({ amplitude: 1 }, 400, 0)).toBe(1)
    })

    test("auto: negative dominant x delta negates amplitude", () => {
        // Moving left: deltaX=-400, auto → dominantDelta=-400 < 0 → flip
        expect(resolveArcAmplitude({ amplitude: 1 }, -400, 0)).toBe(-1)
    })

    test("auto: y dominant when |y| > |x|", () => {
        // deltaY=-300 is dominant over deltaX=100
        expect(resolveArcAmplitude({ amplitude: 1 }, 100, -300)).toBe(-1)
        expect(resolveArcAmplitude({ amplitude: 1 }, 100, 300)).toBe(1)
    })

    test("respects custom amplitude magnitude", () => {
        expect(resolveArcAmplitude({ amplitude: 0.7 }, 100, 0)).toBeCloseTo(0.7)
        expect(resolveArcAmplitude({ amplitude: 0.7 }, -100, 0)).toBeCloseTo(-0.7)
    })
})
