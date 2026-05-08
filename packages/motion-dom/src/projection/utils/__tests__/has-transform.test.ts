import { hasScale, hasTransform } from "../has-transform"

describe("hasScale", () => {
    it("returns false for identity number scales", () => {
        expect(hasScale({})).toBe(false)
        expect(hasScale({ scale: 1 })).toBe(false)
        expect(hasScale({ scaleX: 1, scaleY: 1 })).toBe(false)
    })

    it("returns true for non-identity number scales", () => {
        expect(hasScale({ scale: 0.5 })).toBe(true)
        expect(hasScale({ scaleX: 2 })).toBe(true)
    })

    it("returns false for percentage strings that resolve to identity (#2857)", () => {
        // CSS scale(100%) is equivalent to scale(1) — visual no-op. The
        // projection system must not treat it as a non-identity transform,
        // otherwise the string poisons the layout box math (NaN) and breaks
        // drag/Reorder when wrapped in motion.div.
        expect(hasScale({ scale: "100%" })).toBe(false)
        expect(hasScale({ scaleX: "100%", scaleY: "100%" })).toBe(false)
    })

    it("returns false for numeric strings that resolve to identity", () => {
        expect(hasScale({ scale: "1" })).toBe(false)
        expect(hasScale({ scale: "1.0" })).toBe(false)
    })

    it("returns true for percentage strings that don't resolve to identity", () => {
        expect(hasScale({ scale: "50%" })).toBe(true)
        expect(hasScale({ scale: "200%" })).toBe(true)
    })
})

describe("hasTransform", () => {
    it("returns falsy when only scale: '100%' is set (#2857)", () => {
        expect(hasTransform({ scale: "100%" })).toBeFalsy()
    })
})
