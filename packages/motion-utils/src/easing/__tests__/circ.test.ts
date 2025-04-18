import { circIn, circOut, circInOut } from "../circ"

describe("circ easing", () => {
    test("circInOut is correct", () => {
        expect(circInOut(0.25)).toBe(circIn(0.5) / 2)
        expect(circInOut(0.75)).toBe(0.5 + circOut(0.5) / 2)
    })
})
