import { isZeroValueString } from "../is-zero-value-string"

describe("isZeroValueString", () => {
    test("should correctly identify numerical strings", () => {
        expect(isZeroValueString("0px")).toBe(true)
        expect(isZeroValueString("0%")).toBe(true)
        expect(isZeroValueString("0.5%")).toBe(false)
        expect(isZeroValueString("10.1%")).toBe(false)
        expect(isZeroValueString("0")).toBe(false)
        expect(isZeroValueString("10.1")).toBe(false)
        expect(isZeroValueString("rgb(0,0,0)")).toBe(false)
        expect(isZeroValueString("0px 0px rgba(0,0,0,0)")).toBe(false)
    })
})
