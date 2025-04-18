import { isNumericalString } from "../is-numerical-string"

describe("isNumericalString", () => {
    test("should correctly identify numerical strings", () => {
        expect(isNumericalString("10")).toBe(true)
        expect(isNumericalString("10.1")).toBe(true)
        expect(isNumericalString("-10.1")).toBe(true)
        expect(isNumericalString("10px")).toBe(false)
        expect(isNumericalString("10%")).toBe(false)
        expect(isNumericalString("10.1%")).toBe(false)
        expect(isNumericalString("rgb(0,0,0)")).toBe(false)
    })
})
