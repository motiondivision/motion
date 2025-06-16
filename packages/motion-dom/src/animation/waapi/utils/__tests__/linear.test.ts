import { noop } from "motion-utils"
import { generateLinearEasing } from "../linear"

describe("generateLinearEasing", () => {
    test("Converts easing function into string of points", () => {
        expect(generateLinearEasing(noop, 110)).toEqual(
            "linear(0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1)"
        )
        expect(generateLinearEasing(() => 0.5, 200)).toEqual(
            "linear(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)"
        )
        expect(generateLinearEasing(() => 0.5, 0)).toEqual("linear(0.5, 0.5)")
    })
})
