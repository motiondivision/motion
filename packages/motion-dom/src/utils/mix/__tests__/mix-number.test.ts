import { mixNumber } from "../number"

test("mixNumber", () => {
    expect(mixNumber(0, 1, 0.5)).toBe(0.5)
    expect(mixNumber(-100, 100, 2)).toBe(300)
    expect(mixNumber(10, 20, 0.5)).toBe(15)
    expect(mixNumber(-10, -20, 0.5)).toBe(-15)
    expect(mixNumber(0, 80, 0.5)).toBe(40)
    expect(mixNumber(100, 200, 2)).toBe(300)
    expect(mixNumber(-100, 100, 2)).toBe(300)
})
