import { BezierDefinition } from "motion-utils"
import { cubicBezierAsString } from "../cubic-bezier"
import { supportedWaapiEasing } from "../supported"

describe("supportedWaapiEasing", () => {
    test("should include CSS keyword easings", () => {
        expect(supportedWaapiEasing.linear).toBe("linear")
        expect(supportedWaapiEasing.ease).toBe("ease")
        expect(supportedWaapiEasing.easeIn).toBe("ease-in")
        expect(supportedWaapiEasing.easeOut).toBe("ease-out")
        expect(supportedWaapiEasing.easeInOut).toBe("ease-in-out")
    })

    test("should include cubic-bezier easings for non-standard values", () => {
        const circInBezier: BezierDefinition = [0, 0.65, 0.55, 1]
        expect(supportedWaapiEasing.circIn).toBe(
            cubicBezierAsString(circInBezier)
        )

        const circOutBezier: BezierDefinition = [0.55, 0, 1, 0.45]
        expect(supportedWaapiEasing.circOut).toBe(
            cubicBezierAsString(circOutBezier)
        )

        const backInBezier: BezierDefinition = [0.31, 0.01, 0.66, -0.59]
        expect(supportedWaapiEasing.backIn).toBe(
            cubicBezierAsString(backInBezier)
        )

        const backOutBezier: BezierDefinition = [0.33, 1.53, 0.69, 0.99]
        expect(supportedWaapiEasing.backOut).toBe(
            cubicBezierAsString(backOutBezier)
        )
    })

    test("should have expected keys", () => {
        const expectedKeys = [
            "linear",
            "ease",
            "easeIn",
            "easeOut",
            "easeInOut",
            "circIn",
            "circOut",
            "backIn",
            "backOut",
        ]

        expectedKeys.forEach((key) => {
            expect(supportedWaapiEasing).toHaveProperty(key)
        })
    })
})
