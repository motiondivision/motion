import "../../../../jest.setup"
import { camelToDash } from "../camel-to-dash"

describe("camelToDash", () => {
    it("Converts camel case to dash case", () => {
        expect(camelToDash("camelCase")).toBe("camel-case")
    })
})
