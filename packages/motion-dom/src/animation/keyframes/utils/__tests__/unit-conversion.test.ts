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
    const testDimensions = {
        x: { min: 0, max: 100 },
        y: { min: 0, max: 300 },
    }

    test("Reads used width/height from computed style without measuring the box", () => {
        const measureBox = jest.fn(() => testDimensions)

        expect(
            positionalValues.width(
                { width: "80px", paddingLeft: "50px" },
                measureBox
            )
        ).toBe(80)
        expect(
            positionalValues.height(
                { height: "120.5px", paddingTop: "50px" },
                measureBox
            )
        ).toBe(120.5)

        expect(measureBox).not.toHaveBeenCalled()
    })

    test("Falls back to the bounding box, minus padding, when width/height have no used value", () => {
        const measureBox = () => testDimensions

        expect(
            positionalValues.width(
                { width: "auto", paddingLeft: "50px" },
                measureBox
            )
        ).toBe(50)

        expect(
            positionalValues.width({ paddingRight: "25px" }, measureBox)
        ).toBe(75)

        expect(
            positionalValues.height(
                { height: "auto", paddingTop: "50px" },
                measureBox
            )
        ).toBe(250)

        expect(
            positionalValues.height({ paddingBottom: "25px" }, measureBox)
        ).toBe(275)
    })

    test("Does not subtract padding when box-sizing is border-box", () => {
        const measureBox = () => testDimensions

        expect(
            positionalValues.width(
                {
                    width: "auto",
                    paddingLeft: "50px",
                    paddingRight: "25px",
                    boxSizing: "border-box",
                },
                measureBox
            )
        ).toBe(100)

        expect(
            positionalValues.height(
                {
                    height: "auto",
                    paddingTop: "50px",
                    paddingBottom: "25px",
                    boxSizing: "border-box",
                },
                measureBox
            )
        ).toBe(300)
    })

    test("Measures bottom/right from the bounding box", () => {
        const measureBox = () => testDimensions

        expect(positionalValues.bottom({ top: "10px" }, measureBox)).toBe(310)
        expect(positionalValues.right({ left: "10px" }, measureBox)).toBe(110)
    })

    test("Reads translations from the computed transform", () => {
        const measureBox = jest.fn(() => testDimensions)

        expect(
            positionalValues.x(
                { transform: "matrix(1, 0, 0, 1, 40, 50)" },
                measureBox
            )
        ).toBe(40)
        expect(
            positionalValues.translateY(
                { transform: "matrix(1, 0, 0, 1, 40, 50)" },
                measureBox
            )
        ).toBe(50)

        expect(measureBox).not.toHaveBeenCalled()
    })
})
