import { wrap } from "../wrap"

test("wrap", () => {
    expect(wrap(-100, 100, -100)).toBe(-100)
    expect(wrap(-100, 100, 0)).toBe(0)
    expect(wrap(-100, 100, -200)).toBe(0)
    expect(wrap(-100, 100, 101)).toBe(-99)
})
