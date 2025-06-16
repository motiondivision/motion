import { auto } from "../auto"
import { color } from "../color"
import { complex } from "../complex"
import { findDimensionValueType } from "../dimensions"
import { number } from "../numbers"
import { degrees, percent, px, vh, vw } from "../numbers/units"
import { findValueType } from "../utils/find"
import { getValueAsType } from "../utils/get-as-type"

describe("auto ValueType", () => {
    it("Correctly tests for auto", () => {
        expect(auto.test(0)).toBe(false)
        expect(auto.test("10px")).toBe(false)
        expect(auto.test("auto")).toBe(true)
    })
})

describe("findDimensionValueType", () => {
    it("Correctly finds ValueType for provided dimension", () => {
        expect(findDimensionValueType(0)).toBe(number)
        expect(findDimensionValueType("0px")).toBe(px)
        expect(findDimensionValueType("0%")).toBe(percent)
        expect(findDimensionValueType("50deg")).toBe(degrees)
        expect(findDimensionValueType("4vw")).toBe(vw)
        expect(findDimensionValueType("4vh")).toBe(vh)
        expect(findDimensionValueType("g")).toBe(undefined)
    })
})

describe("findValueType", () => {
    it("Correctly finds ValueType for provided value", () => {
        expect(findValueType(0)).toBe(number)
        expect(findValueType("0px")).toBe(px)
        expect(findValueType("0%")).toBe(percent)
        expect(findValueType("50deg")).toBe(degrees)
        expect(findValueType("4vw")).toBe(vw)
        expect(findValueType("4vh")).toBe(vh)
        expect(findValueType("#fff")).toBe(color)
        expect(findValueType("rgba(0, 0, 0, 0)")).toBe(color)
        expect(findValueType("hsla(0, 0, 0, 0)")).toBe(color)
        expect(findValueType("#fff scale(1)")).toBe(complex)
    })
})

describe("getValueAsType", () => {
    it("Correctly returns only numbers as the provided ValueType", () => {
        expect(getValueAsType(100, px)).toBe("100px")
        expect(getValueAsType("100%", px)).toBe("100%")
        expect(getValueAsType(100)).toBe(100)
    })
})
