import { scalePoint, applyPointDelta, applyAxisDelta, transformBox } from "../delta-apply"

describe("scalePoint", () => {
    test("correctly scales a point based on a factor and an originPoint", () => {
        expect(scalePoint(100, 2, 50)).toBe(150)
        expect(scalePoint(100, 0.5, 50)).toBe(75)
        expect(scalePoint(100, 2, 150)).toBe(50)
        expect(scalePoint(100, 0.5, 150)).toBe(125)
    })
})

describe("applyPointDelta", () => {
    test("correctly applies a delta to a point", () => {
        expect(applyPointDelta(100, 100, 2, 50)).toBe(250)
        expect(applyPointDelta(100, 100, 2, 150)).toBe(150)
    })

    test("correctly applies a delta to a point with an additional boxScale", () => {
        expect(applyPointDelta(100, 100, 2, 50, 2)).toBe(350)
        expect(applyPointDelta(100, 100, 2, 150, 2)).toBe(50)
    })
})

describe("applyAxisDelta", () => {
    test("correctly applies a delta to an axis", () => {
        const axis = { min: 100, max: 200 }
        applyAxisDelta(axis, 100, 2, 150)
        expect(axis).toEqual({ min: 150, max: 350 })
    })

    test("correctly applies a delta to an axis with an additional boxScale", () => {
        const axis = { min: 100, max: 200 }
        applyAxisDelta(axis, 100, 2, 150, 2)
        expect(axis).toEqual({ min: 50, max: 450 })
    })
})

describe("transformBox", () => {
    test("correctly handles percentage x values by resolving to axis width", () => {
        const box = {
            x: { min: 100, max: 300 },
            y: { min: 0, max: 100 },
        }
        // 100% of width (200px) should translate x by 200px
        transformBox(box, { x: "100%" } as any)
        expect(box.x).toEqual({ min: 300, max: 500 })
        expect(box.y).toEqual({ min: 0, max: 100 })
    })

    test("correctly handles percentage y values by resolving to axis height", () => {
        const box = {
            x: { min: 0, max: 100 },
            y: { min: 100, max: 300 },
        }
        // 50% of height (200px) = 100px
        transformBox(box, { y: "50%" } as any)
        expect(box.y).toEqual({ min: 200, max: 400 })
        expect(box.x).toEqual({ min: 0, max: 100 })
    })

    test("correctly handles 0% as no translation", () => {
        const box = {
            x: { min: 100, max: 300 },
            y: { min: 0, max: 100 },
        }
        transformBox(box, { x: "0%" } as any)
        expect(box.x).toEqual({ min: 100, max: 300 })
    })
})

// describe("applyTreeDeltas", () => {
//   test("correctly applies tree deltas to a box", () => {
//       const box = {
//           x: { min: 100, max: 200 },
//           y: { min: 300, max: 400 },
//       }

//       const delta = {
//           x: { translate: 100, scale: 4, origin: 0.5, originPoint: 150 },
//           y: { translate: -100, scale: 0.5, origin: 0.5, originPoint: 350 },
//       }

//       const element = htmlVisualElement(
//           {
//               props: {},
//               visualState: {
//                   latestValues: {},
//                   renderState: createHtmlRenderState(),
//               },
//           },
//           {}
//       )
//       element.getLayoutState().delta = delta

//       const treeScale = { x: 1, y: 1 }
//       applyTreeDeltas(box, treeScale, [element, element])

//       expect(box).toEqual({
//           x: { min: -150, max: 1450 },
//           y: { min: 187.5, max: 212.5 },
//       })
//       expect(treeScale).toEqual({ x: 16, y: 0.25 })
//   })
// })
