import "../../../../jest.setup"
import { camelToDash } from "motion-dom"

describe("camelToDash", () => {
    it("Converts camel case to dash case", () => {
        expect(camelToDash("camelCase")).toBe("camel-case")
    })
})
