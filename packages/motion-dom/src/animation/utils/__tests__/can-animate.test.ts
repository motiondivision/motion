import { canAnimate } from "../can-animate"

describe("canAnimate", () => {
    it("returns true for valid filter blur keyframes", () => {
        expect(
            canAnimate(["blur(10px)", "blur(0px)"], "filter")
        ).toBeTruthy()
    })

    it("returns false for bare filter function names without parentheses", () => {
        expect(canAnimate(["blur(10px)", "blur"], "filter")).toBeFalsy()
    })

    it("returns false when both keyframes are non-animatable", () => {
        expect(canAnimate(["blur", "blur"], "filter")).toBeFalsy()
    })

    it("returns false when origin keyframe is null", () => {
        expect(canAnimate([null, "blur(10px)"], "filter")).toBe(false)
    })

    it("returns true for opacity keyframes", () => {
        expect(canAnimate([0, 1], "opacity")).toBeTruthy()
    })
})
