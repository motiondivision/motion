import { clamp } from "../clamp"

test("clamp", () => {
    expect(clamp(100, 200, 99)).toBe(100)
    expect(clamp(100, 200, 201)).toBe(200)
    expect(clamp(100, 200, 150)).toBe(150)
})
