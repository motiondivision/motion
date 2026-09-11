import { motionValue } from "../../../../value"
import {
    positionalValues,
    removeNonTranslationalTransform,
} from "../unit-conversion"

describe("removeNonTranslationalTransform", () => {
    test("resets transforms that would change the bounding box", () => {
        const values = new Map([
            ["x", motionValue(50)],
            ["rotate", motionValue(45)],
            ["scale", motionValue(2)],
            ["scaleX", motionValue(1)],
            ["skewX", motionValue(0)],
        ])
        const visualElement = { getValue: (key: string) => values.get(key) }

        const removed = removeNonTranslationalTransform(visualElement as any)

        expect(removed).toEqual([
            ["scale", 2],
            ["rotate", 45],
        ])
        expect(values.get("rotate")!.get()).toBe(0)
        expect(values.get("scale")!.get()).toBe(1)
        // Translations and defaults are left alone
        expect(values.get("x")!.get()).toBe(50)
        expect(values.get("scaleX")!.get()).toBe(1)
        expect(values.get("skewX")!.get()).toBe(0)
    })

    test("returns nothing when every transform is already default", () => {
        const values = new Map([
            ["rotate", motionValue(0)],
            ["scale", motionValue(1)],
        ])
        const visualElement = { getValue: (key: string) => values.get(key) }

        expect(removeNonTranslationalTransform(visualElement as any)).toEqual(
            []
        )
    })
})

describe("Unit conversion", () => {
    test("Correctly factors in padding when measuring width/height", () => {
        const testDimensions = {
            x: { min: 0, max: 100 },
            y: { min: 0, max: 300 },
        }
        expect(
            positionalValues.width(testDimensions, { paddingLeft: "50px" })
        ).toBe(50)

        expect(
            positionalValues.width(testDimensions, { paddingRight: "25px" })
        ).toBe(75)

        expect(
            positionalValues.height(testDimensions, { paddingTop: "50px" })
        ).toBe(250)

        expect(
            positionalValues.height(testDimensions, { paddingBottom: "25px" })
        ).toBe(275)
    })

    test("Does not subtract padding when box-sizing is border-box", () => {
        const testDimensions = {
            x: { min: 0, max: 100 },
            y: { min: 0, max: 300 },
        }
        expect(
            positionalValues.width(testDimensions, {
                paddingLeft: "50px",
                paddingRight: "25px",
                boxSizing: "border-box",
            })
        ).toBe(100)

        expect(
            positionalValues.height(testDimensions, {
                paddingTop: "50px",
                paddingBottom: "25px",
                boxSizing: "border-box",
            })
        ).toBe(300)
    })
})
