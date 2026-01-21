import { sanitize } from "../sanitize"
import { complex } from "../../complex"

describe("sanitize", () => {
    it("rounds numbers to 5 decimal places", () => {
        expect(sanitize(1.123456789)).toBe(1.12346)
        expect(sanitize(0.000001)).toBe(0)
        expect(sanitize(0.00001)).toBe(0.00001)
    })

    it("handles integers without modification", () => {
        expect(sanitize(0)).toBe(0)
        expect(sanitize(1)).toBe(1)
        expect(sanitize(100)).toBe(100)
        expect(sanitize(-50)).toBe(-50)
    })

    it("handles negative decimals", () => {
        expect(sanitize(-1.123456789)).toBe(-1.12346)
    })

    it("returns 0 for NaN values", () => {
        // This is the core bug fix for issue #2791
        // NaN can be produced by spring animations in edge cases
        expect(sanitize(NaN)).toBe(0)
    })

    /**
     * Issue #2791: NaN in SVG polygon points during spring animation
     *
     * When animating SVG polygon points like "0,0 100,0 100,100" with spring
     * animations, NaN values can be produced in edge cases (e.g., when
     * certain spring parameters cause division issues in the animation
     * generator). These NaN values then propagate through the complex value
     * transformer and result in invalid SVG like "0,NaN 100,0 NaN,100".
     *
     * The fix ensures sanitize() returns 0 for NaN inputs, preventing
     * invalid values from being rendered to the DOM.
     */
    it("prevents NaN from propagating to SVG polygon points (issue #2791)", () => {
        // Simulate SVG polygon points
        const polygonPoints = "0,0 100,0 100,100 0,100"
        const transformer = complex.createTransformer(polygonPoints)

        // Simulate a case where spring animation produces NaN for one of the coordinates
        // This can happen in edge cases with certain spring parameters
        const valuesWithNaN = [0, NaN, 100, 0, 100, 100, 0, 100]

        const result = transformer(valuesWithNaN)

        // The result should NOT contain "NaN" - the NaN should be replaced with 0
        expect(result).not.toContain("NaN")
        expect(result).toBe("0,0 100,0 100,100 0,100")
    })
})
