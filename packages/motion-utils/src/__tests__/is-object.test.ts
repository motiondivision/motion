import { isObject } from "../is-object"

describe("isObject", () => {
    it("should return true for an object", () => {
        expect(isObject({})).toBe(true)
    })

    it("should return false for a non-object", () => {
        expect(isObject(null)).toBe(false)
        expect(isObject(undefined)).toBe(false)
        expect(isObject(1)).toBe(false)
    })
})
