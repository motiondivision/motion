import { isAnimatable } from "../is-animatable"

describe("isAnimatable", () => {
    it("returns true for valid filter blur values", () => {
        expect(isAnimatable("blur(10px)", "filter")).toBe(true)
        expect(isAnimatable("blur(0px)", "filter")).toBe(true)
        expect(isAnimatable("blur(0)", "filter")).toBe(true)
        expect(isAnimatable("blur(5.5px)", "filter")).toBe(true)
    })

    it("returns false for bare filter function names without parentheses", () => {
        expect(isAnimatable("blur", "filter")).toBe(false)
        expect(isAnimatable("brightness", "filter")).toBe(false)
        expect(isAnimatable("contrast", "filter")).toBe(false)
    })

    it("returns true for complex filter values", () => {
        expect(
            isAnimatable(
                "blur(10px) brightness(50%) contrast(100%)",
                "filter"
            )
        ).toBe(true)
    })

    it("returns true for numeric values", () => {
        expect(isAnimatable(0)).toBe(true)
        expect(isAnimatable(100)).toBe(true)
    })

    it("returns false for non-animatable strings", () => {
        expect(isAnimatable("none")).toBe(false)
        expect(isAnimatable("url(image.png)")).toBe(false)
    })
})
