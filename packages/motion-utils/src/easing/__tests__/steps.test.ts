import { steps } from "../steps"

test("steps", () => {
    const stepEnd = steps(4)

    expect(stepEnd(0)).toBe(0)
    expect(stepEnd(0.2)).toBe(0)
    expect(stepEnd(0.249)).toBe(0)
    expect(stepEnd(0.25)).toBe(0.25)
    expect(stepEnd(0.49)).toBe(0.25)
    expect(stepEnd(0.5)).toBe(0.5)
    expect(stepEnd(0.99)).toBe(0.75)
    expect(stepEnd(1)).toBe(0.75)

    const stepStart = steps(4, "start")
    expect(stepStart(0)).toBe(0.25)
    expect(stepStart(0.2)).toBe(0.25)
    expect(stepStart(0.249)).toBe(0.25)
    expect(stepStart(0.25)).toBe(0.25)
    expect(stepStart(0.49)).toBe(0.5)
    expect(stepStart(0.5)).toBe(0.5)
    expect(stepStart(0.51)).toBe(0.75)
    expect(stepStart(0.99)).toBe(1)
    expect(stepStart(1)).toBe(1)
    expect(stepStart(2)).toBe(1)
})
