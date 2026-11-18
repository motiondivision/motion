import {
    applyConstraints,
    calcRelativeAxisConstraints,
    calcViewportAxisConstraints,
    resolveDragElastic,
} from "../constraints"

describe("resolveDragElastic", () => {
    test("Resolves false as 0", () => {
        expect(resolveDragElastic(false)).toEqual({
            x: { min: 0, max: 0 },
            y: { min: 0, max: 0 },
        })
    })
    test("Resolves true as default", () => {
        expect(resolveDragElastic(true)).toEqual({
            x: { min: 0.35, max: 0.35 },
            y: { min: 0.35, max: 0.35 },
        })
    })

    test("Resolves number as object filled with number", () => {
        expect(resolveDragElastic(0.5)).toEqual({
            x: { min: 0.5, max: 0.5 },
            y: { min: 0.5, max: 0.5 },
        })
    })

    test("Resolves object as object, with default values for missing values", () => {
        expect(
            resolveDragElastic({ top: 0.1, left: 0.2, bottom: 0.3, right: 0.4 })
        ).toEqual({
            x: { min: 0.2, max: 0.4 },
            y: { min: 0.1, max: 0.3 },
        })
        expect(resolveDragElastic({ top: 0.1, right: 0.4 })).toEqual({
            x: { min: 0, max: 0.4 },
            y: { min: 0.1, max: 0 },
        })
    })
})

describe("applyConstraints", () => {
    test("Returns points within the defined constraints", () => {
        expect(applyConstraints(10, { min: 0, max: 20 })).toBe(10)
    })
    test("Applies elastic factor", () => {
        expect(
            applyConstraints(25, { min: 0, max: 20 }, { min: 0.5, max: 0.5 })
        ).toBe(22.5)
        expect(
            applyConstraints(25, { min: 0, max: 20 }, { min: 1, max: 0.5 })
        ).toBe(22.5)
        expect(
            applyConstraints(-5, { min: 0, max: 20 }, { min: 0.5, max: 0.5 })
        ).toBe(-2.5)
        expect(
            applyConstraints(-5, { min: 0, max: 20 }, { min: 0.5, max: 1 })
        ).toBe(-2.5)
        expect(
            applyConstraints(25, { min: 0, max: 20 }, { min: 1, max: 1 })
        ).toBe(25)
        expect(
            applyConstraints(-5, { min: 0, max: 20 }, { min: 1, max: 1 })
        ).toBe(-5)
        expect(
            applyConstraints(25, { min: 0, max: 20 }, { min: 0, max: 0 })
        ).toBe(20)
        expect(
            applyConstraints(25, { min: 0, max: 20 }, { min: 1, max: 0 })
        ).toBe(20)
        expect(
            applyConstraints(-5, { min: 0, max: 20 }, { min: 0, max: 0 })
        ).toBe(0)
        expect(
            applyConstraints(-5, { min: 0, max: 20 }, { min: 0, max: 1 })
        ).toBe(0)
    })
})

describe("calcRelativeAxisConstraints", () => {
    test("Returns the constraints it's given", () => {
        expect(calcRelativeAxisConstraints(-100, 300)).toEqual({
            min: -100,
            max: 300,
        })
        expect(calcRelativeAxisConstraints(0, 0)).toEqual({ min: 0, max: 0 })
    })

    test("Leaves out an edge that isn't defined", () => {
        expect("min" in calcRelativeAxisConstraints(undefined, 300)).toBe(false)
        expect("max" in calcRelativeAxisConstraints(-100)).toBe(false)
        expect(calcRelativeAxisConstraints()).toEqual({})
    })
})

describe("calcViewportAxisConstraints", () => {
    test("Correctly calculates constraints relative to the viewport when axis is smaller than and within constraints", () => {
        expect(
            calcViewportAxisConstraints(
                { min: 200, max: 250 },
                { min: 100, max: 300 }
            )
        ).toEqual({ min: -100, max: 50 })
    })
    test("Correctly calculates constraints relative to the viewport when axis is smaller than and overlaps constraints", () => {
        expect(
            calcViewportAxisConstraints(
                { min: 350, max: 450 },
                { min: 100, max: 300 }
            )
        ).toEqual({ min: -250, max: -150 })
    })
    test("Correctly calculates constraints relative to the viewport when axis is larger than constraints", () => {
        expect(
            calcViewportAxisConstraints(
                { min: 100, max: 600 },
                { min: 100, max: 300 }
            )
        ).toEqual({ min: -300, max: 0 })
    })
})
