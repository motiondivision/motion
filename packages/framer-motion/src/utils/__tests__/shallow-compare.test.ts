import "../../jest.setup"
import { shallowCompare } from "../shallow-compare"

describe("shallowCompare", () => {
    test("returns false if args are different", () => {
        expect(shallowCompare([0], null)).toBe(false)
        expect(shallowCompare([0], [1])).toBe(false)
        expect(shallowCompare([0], [0, 1])).toBe(false)
        expect(shallowCompare([[]], [[]])).toBe(false)
        expect(shallowCompare([{}], [{}])).toBe(false)
    })
    test("returns true if args are same", () => {
        expect(shallowCompare([0, 1, "a"], [0, 1, "a"])).toBe(true)
        const arr = [0, 1, 2]
        expect(shallowCompare([arr], [arr])).toBe(true)
        expect(shallowCompare([], [])).toBe(true)
    })
})
