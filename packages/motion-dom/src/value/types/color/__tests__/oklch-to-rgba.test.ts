import { oklchToRgba } from "../oklch-to-rgba"

describe("oklchToRgba", () => {
    test("Correctly converts oklch to rgba", () => {
        expect(
            oklchToRgba({
                lightness: 90.08,
                chroma: 0.0853,
                hue: 211.65,
                alpha: 1,
            })
        ).toEqual({ red: 153, green: 238, blue: 255, alpha: 1 })
    })
})
