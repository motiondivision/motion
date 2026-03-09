import { positionalValues } from "../unit-conversion"

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
