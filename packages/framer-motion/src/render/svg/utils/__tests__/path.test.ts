import { buildSVGPath } from "motion-dom"
import "../../../../jest.setup"

describe("buildSVGPath", () => {
    it("correctly generates SVG path props", () => {
        const attrs: {
            ["stroke-dashoffset"]?: string
            ["stroke-dasharray"]?: string
        } = {}

        buildSVGPath(attrs, 0.5, 0.25, 0.25)

        // Uses unitless values to avoid Safari zoom bug
        expect(attrs["stroke-dashoffset"]).toBe("-0.25")
        expect(attrs["stroke-dasharray"]).toBe("0.5 0.25")
    })
})
