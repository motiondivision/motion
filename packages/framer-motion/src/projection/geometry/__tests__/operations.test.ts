import { createAxis, translateAxis } from "motion-dom"

describe("translateAxis", () => {
    it("applies a translation to an Axis", () => {
        const axis = createAxis()
        axis.max = 100

        translateAxis(axis, 100)
        expect(axis).toEqual({ min: 100, max: 200 })
        translateAxis(axis, -100)
        expect(axis).toEqual({ min: 0, max: 100 })
    })
})
