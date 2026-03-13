import { hasBrowserOnlyColors } from "../is-browser-color"

describe("hasBrowserOnlyColors", () => {
    it("returns true for oklch values", () => {
        expect(hasBrowserOnlyColors(["oklch(0.65 0.18 260)"])).toBe(true)
    })

    it("returns true for oklab values", () => {
        expect(hasBrowserOnlyColors(["oklab(0.5 0.1 -0.1)"])).toBe(true)
    })

    it("returns true for lab values", () => {
        expect(hasBrowserOnlyColors(["lab(50 20 -30)"])).toBe(true)
    })

    it("returns true for lch values", () => {
        expect(hasBrowserOnlyColors(["lch(50 30 260)"])).toBe(true)
    })

    it("returns true for color() values", () => {
        expect(
            hasBrowserOnlyColors(["color(display-p3 1 0.5 0)"])
        ).toBe(true)
    })

    it("returns true for color-mix() values", () => {
        expect(
            hasBrowserOnlyColors(["color-mix(in srgb, red 50%, blue)"])
        ).toBe(true)
    })

    it("returns true for light-dark() values", () => {
        expect(
            hasBrowserOnlyColors(["light-dark(white, black)"])
        ).toBe(true)
    })

    it("is case insensitive", () => {
        expect(hasBrowserOnlyColors(["OKLCH(0.65 0.18 260)"])).toBe(true)
        expect(hasBrowserOnlyColors(["OkLab(0.5 0.1 -0.1)"])).toBe(true)
    })

    it("returns true when browser-only color is mixed with parseable colors", () => {
        expect(
            hasBrowserOnlyColors(["#ffffff", "oklch(0.65 0.18 260)"])
        ).toBe(true)
    })

    it("returns false for hex colors", () => {
        expect(hasBrowserOnlyColors(["#ffffff", "#000000"])).toBe(false)
    })

    it("returns false for rgb colors", () => {
        expect(hasBrowserOnlyColors(["rgb(255, 0, 0)"])).toBe(false)
    })

    it("returns false for hsl colors", () => {
        expect(hasBrowserOnlyColors(["hsl(120, 100%, 50%)"])).toBe(false)
    })

    it("returns false for numbers", () => {
        expect(hasBrowserOnlyColors([0, 1, 0.5])).toBe(false)
    })

    it("returns false for empty arrays", () => {
        expect(hasBrowserOnlyColors([])).toBe(false)
    })
})
