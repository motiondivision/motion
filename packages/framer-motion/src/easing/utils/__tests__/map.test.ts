import { noop } from "motion-utils"
import { backIn } from "../../../../../motion-utils/src/easing/back"
import { cubicBezier } from "../../../../../motion-utils/src/easing/cubic-bezier"
import { easeInOut } from "../../../../../motion-utils/src/easing/ease"
import { easingDefinitionToFunction } from "../map"

describe("easingDefinitionToFunction", () => {
    test("Maps easing to lookup", () => {
        expect(easingDefinitionToFunction("linear")).toBe(noop)
        expect(easingDefinitionToFunction("easeInOut")).toBe(easeInOut)
        expect(easingDefinitionToFunction("backIn")).toBe(backIn)
        expect(easingDefinitionToFunction(backIn)).toBe(backIn)

        const bezier = easingDefinitionToFunction([0.2, 0.2, 0.8, 1])
        expect(bezier(0.45)).toEqual(cubicBezier(0.2, 0.2, 0.8, 1)(0.45))
    })
})
