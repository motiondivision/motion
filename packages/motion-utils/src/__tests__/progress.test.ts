import { progress } from "../progress"

test("progress", () => {
    expect(progress(0, 100, 50)).toBe(0.5)
    expect(progress(100, -100, 50)).toBe(0.25)
    expect(progress(100, -100, -300)).toBe(2)
})
