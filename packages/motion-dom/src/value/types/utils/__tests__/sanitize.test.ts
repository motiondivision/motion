import { sanitize } from "../sanitize"

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
})
