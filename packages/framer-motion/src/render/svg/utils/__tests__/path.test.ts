import "../../../../jest.setup"
import { buildSVGPath } from "../path"

describe("buildSVGPath", () => {
    it("correctly generates SVG path props", () => {
        const attrs: {
            ["stroke-dashoffset"]?: number
            ["stroke-dasharray"]?: number
        } = {}

        buildSVGPath(attrs, 0.5, 0.25, 0.25)

        expect(attrs["stroke-dashoffset"]).toBe("-0.25px")
        expect(attrs["stroke-dasharray"]).toBe("0.5px 0.25px")
    })
})
