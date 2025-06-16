import { BezierDefinition, Easing } from "motion-utils"
import { cubicBezierAsString } from "../cubic-bezier"
import { mapEasingToNativeEasing } from "../map-easing"

describe("mapEasingToNativeEasing", () => {
    test("should return undefined for undefined easing", () => {
        expect(mapEasingToNativeEasing(undefined, 1000)).toBeUndefined()
    })

    test("should map string easing to corresponding value in supportedWaapiEasing", () => {
        expect(mapEasingToNativeEasing("linear", 1000)).toBe("linear")
        expect(mapEasingToNativeEasing("easeIn", 1000)).toBe("ease-in")
        expect(mapEasingToNativeEasing("easeOut", 1000)).toBe("ease-out")
    })

    test("should map bezier definition to cubic-bezier string", () => {
        const bezier: BezierDefinition = [0.42, 0, 1, 1]
        expect(mapEasingToNativeEasing(bezier, 1000)).toBe(
            cubicBezierAsString(bezier)
        )
    })

    test("should map array of easings to array of strings", () => {
        // Only test with known easings that don't require mocking
        const easings: Easing[] = ["linear", "easeIn", "easeOut"]
        const result = mapEasingToNativeEasing(easings, 1000) as string[]

        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBe(3)
        expect(typeof result[0]).toBe("string")
        expect(result[0]).toBe("linear")
        expect(result[1]).toBe("ease-in")
        expect(result[2]).toBe("ease-out")
    })
})
