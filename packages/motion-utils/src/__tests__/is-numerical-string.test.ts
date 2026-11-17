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

    test("should accept exponents", () => {
        expect(isNumericalString("1e-7")).toBe(true)
        expect(isNumericalString("-2.5E+3")).toBe(true)
        expect(isNumericalString(".5e2")).toBe(true)
        expect(isNumericalString("1e")).toBe(false)
        expect(isNumericalString("1em")).toBe(false)
        expect(isNumericalString("e5")).toBe(false)
    })
})
