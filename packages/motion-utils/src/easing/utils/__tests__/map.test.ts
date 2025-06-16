import { backIn, cubicBezier, easeInOut, noop } from "../../../"
import { easingDefinitionToFunction } from "../map"

describe("easingDefinitionToFunction", () => {
    test("Maps easing to lookup", () => {
        expect(easingDefinitionToFunction("easeInOut")).toBe(easeInOut)
        expect(easingDefinitionToFunction("linear")).toBe(noop)
        expect(easingDefinitionToFunction("backIn")).toBe(backIn)
        expect(easingDefinitionToFunction(backIn)).toBe(backIn)

        const bezier = easingDefinitionToFunction([0.2, 0.2, 0.8, 1])
        expect(bezier(0.45)).toEqual(cubicBezier(0.2, 0.2, 0.8, 1)(0.45))
    })
})
