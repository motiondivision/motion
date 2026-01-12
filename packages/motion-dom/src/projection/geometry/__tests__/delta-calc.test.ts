import { isNear, calcAxisDelta, calcRelativeBox, calcRelativePosition } from "../delta-calc"
import { applyAxisDelta } from "../delta-apply"
import { createBox, createDelta } from "../models"

describe("isNear", () => {
    test("Correctly indicate when the provided value is within maxDistance of the provided target", () => {
        expect(isNear(10.1, 10, 0.1)).toBe(true)
        expect(isNear(9.9, 10, 0.1)).toBe(true)
        expect(isNear(10.2, 10, 0.1)).toBe(false)
        expect(isNear(9.8, 10, 0.1)).toBe(false)
    })
})

describe("calcAxisDelta", () => {
    test("Correctly calculate the a delta that, when applied to source, will make it the same as target", () => {
        const delta = createDelta()

        const source = { min: 100, max: 200 }
        const target = { min: 300, max: 500 }
        calcAxisDelta(delta.x, source, target)
        expect(delta.x).toEqual({
            translate: 250,
            scale: 2,
            origin: 0.5,
            originPoint: 150,
        })

        applyAxisDelta(
            source,
            delta.x.translate,
            delta.x.scale,
            delta.x.originPoint
        )
        expect(source).toEqual(target)
    })

    test("Accepts a custom origin", () => {
        const delta = createDelta()

        const source = { min: 100, max: 200 }
        const target = { min: 300, max: 500 }
        calcAxisDelta(delta.x, source, target, 0)
        expect(delta.x).toEqual({
            translate: 200,
            scale: 2,
            origin: 0,
            originPoint: 100,
        })

        applyAxisDelta(
            source,
            delta.x.translate,
            delta.x.scale,
            delta.x.originPoint
        )
        expect(source).toEqual(target)
    })
})

describe("calcRelativeBox", () => {
    const target = createBox()

    calcRelativeBox(
        target,
        { x: { min: 100, max: 150 }, y: { min: -100, max: 0 } },
        { x: { min: 500, max: 800 }, y: { min: 100, max: 200 } }
    )

    expect(target).toEqual({
        x: { min: 600, max: 650 },
        y: { min: 0, max: 100 },
    })
})

describe("calcRelativePosition", () => {
    const target = createBox()

    calcRelativePosition(
        target,
        { x: { min: 600, max: 650 }, y: { min: 200, max: 300 } },
        { x: { min: 500, max: 800 }, y: { min: 100, max: 200 } }
    )

    expect(target).toEqual({
        x: { min: 100, max: 150 },
        y: { min: 100, max: 200 },
    })

    calcRelativePosition(
        target,
        { x: { min: 600, max: 650 }, y: { min: 200, max: 300 } },
        { x: { min: 600, max: 650 }, y: { min: 200, max: 300 } }
    )

    expect(target).toEqual({
        x: { min: 0, max: 50 },
        y: { min: 0, max: 100 },
    })
})
