import { isNear, calcAxisDelta, calcRelativeBox, calcRelativePosition, calcRelativeAxisPosition, calcRelativeAxis } from "../delta-calc"
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
    test("Resolves relative box from parent.min (default anchor=0)", () => {
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

    test("Resolves relative box with anchor={x:0.5,y:0.5}", () => {
        const target = createBox()
        // Parent: x=[500,800] (center=650), y=[100,200] (center=150)
        // Relative: x=[0,50], y=[0,100]
        // With center anchor: x=[650+0, 650+50]=[650,700], y=[150+0, 150+100]=[150,250]
        calcRelativeBox(
            target,
            { x: { min: 0, max: 50 }, y: { min: 0, max: 100 } },
            { x: { min: 500, max: 800 }, y: { min: 100, max: 200 } },
            { x: 0.5, y: 0.5 }
        )

        expect(target).toEqual({
            x: { min: 650, max: 700 },
            y: { min: 150, max: 250 },
        })
    })
})

describe("calcRelativePosition", () => {
    test("Calculates relative position from parent.min (default anchor=0)", () => {
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

    test("With anchor=0.5, centered child produces offset ~0", () => {
        const target = createBox()
        // Parent: x=[100,400] (length=300, center=250)
        // Child: x=[200,300] (length=100, centered within parent)
        // Relative to center: 200 - 250 = -50
        calcRelativePosition(
            target,
            { x: { min: 200, max: 300 }, y: { min: 150, max: 250 } },
            { x: { min: 100, max: 400 }, y: { min: 100, max: 300 } },
            { x: 0.5, y: 0.5 }
        )

        expect(target).toEqual({
            x: { min: -50, max: 50 },
            y: { min: -50, max: 50 },
        })
    })

    test("Roundtrip: calcRelativePosition then calcRelativeBox returns original box", () => {
        const child = { x: { min: 200, max: 300 }, y: { min: 150, max: 250 } }
        const parent = { x: { min: 100, max: 400 }, y: { min: 100, max: 300 } }
        const anchor = { x: 0.5, y: 0.5 }

        const relative = createBox()
        calcRelativePosition(relative, child, parent, anchor)

        const reconstructed = createBox()
        calcRelativeBox(reconstructed, relative, parent, anchor)

        expect(reconstructed.x.min).toBeCloseTo(child.x.min)
        expect(reconstructed.x.max).toBeCloseTo(child.x.max)
        expect(reconstructed.y.min).toBeCloseTo(child.y.min)
        expect(reconstructed.y.max).toBeCloseTo(child.y.max)
    })

    test("Roundtrip with anchor=0 also works (backward compatible)", () => {
        const child = { x: { min: 600, max: 650 }, y: { min: 200, max: 300 } }
        const parent = { x: { min: 500, max: 800 }, y: { min: 100, max: 200 } }

        const relative = createBox()
        calcRelativePosition(relative, child, parent)

        const reconstructed = createBox()
        calcRelativeBox(reconstructed, relative, parent)

        expect(reconstructed).toEqual({
            x: { min: child.x.min, max: child.x.max },
            y: { min: child.y.min, max: child.y.max },
        })
    })
})

describe("calcRelativeAxisPosition with anchor", () => {
    test("anchor=0 is identical to default (parent.min)", () => {
        const target1 = { min: 0, max: 0 }
        const target2 = { min: 0, max: 0 }
        const layout = { min: 200, max: 300 }
        const parent = { min: 100, max: 500 }

        calcRelativeAxisPosition(target1, layout, parent, 0)
        calcRelativeAxisPosition(target2, layout, parent)

        expect(target1).toEqual(target2)
    })

    test("anchor=1 measures from parent.max", () => {
        const target = { min: 0, max: 0 }
        // Parent: [100,500] (length=400), anchor=1 → anchorPoint=500
        // Layout: [200,300] → relative.min = 200 - 500 = -300
        calcRelativeAxisPosition(target, { min: 200, max: 300 }, { min: 100, max: 500 }, 1)

        expect(target).toEqual({ min: -300, max: -200 })
    })
})

describe("calcRelativeAxis with anchor", () => {
    test("anchor=0 is identical to default (parent.min)", () => {
        const target1 = { min: 0, max: 0 }
        const target2 = { min: 0, max: 0 }
        const relative = { min: 100, max: 150 }
        const parent = { min: 500, max: 800 }

        calcRelativeAxis(target1, relative, parent, 0)
        calcRelativeAxis(target2, relative, parent)

        expect(target1).toEqual(target2)
    })

    test("anchor=0.5 resolves from parent center", () => {
        const target = { min: 0, max: 0 }
        // Parent: [500,800] (length=300, center=650)
        // Relative: [-25, 25] (length=50, centered)
        // Result: [650-25, 650+25] = [625, 675]
        calcRelativeAxis(target, { min: -25, max: 25 }, { min: 500, max: 800 }, 0.5)

        expect(target).toEqual({ min: 625, max: 675 })
    })
})
