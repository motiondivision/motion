import { normaliseAcceleratedKeyframes } from "../normalize-keyframes"

describe("normaliseAcceleratedKeyframes", () => {
    test("ignores unrelated properties", () => {
        expect(
            normaliseAcceleratedKeyframes("opacity", [0, 1])
        ).toEqual([0, 1])
        expect(
            normaliseAcceleratedKeyframes("transform", [
                "translateX(0)",
                "translateX(100px)",
            ])
        ).toEqual(["translateX(0)", "translateX(100px)"])
    })

    test("converts unitless 0 to 0px in clipPath inset() values", () => {
        expect(
            normaliseAcceleratedKeyframes("clipPath", [
                "inset(0 0px 0 0px)",
                "inset(0 120px 0 120px)",
            ])
        ).toEqual([
            "inset(0px 0px 0px 0px)",
            "inset(0px 120px 0px 120px)",
        ])
    })

    test("leaves already-normalised clipPath values untouched", () => {
        expect(
            normaliseAcceleratedKeyframes("clipPath", [
                "inset(0px 0px 0px 0px)",
                "inset(0px 120px 0px 120px)",
            ])
        ).toEqual([
            "inset(0px 0px 0px 0px)",
            "inset(0px 120px 0px 120px)",
        ])
    })

    test("does not change percentage values", () => {
        expect(
            normaliseAcceleratedKeyframes("clipPath", [
                "inset(0% 0% 0% 0%)",
                "inset(0% 50% 0% 50%)",
            ])
        ).toEqual(["inset(0% 0% 0% 0%)", "inset(0% 50% 0% 50%)"])
    })

    test("normalises bare zero shorthand", () => {
        expect(
            normaliseAcceleratedKeyframes("clipPath", [
                "inset(0)",
                "inset(20px)",
            ])
        ).toEqual(["inset(0px)", "inset(20px)"])
    })

    test("normalises polygon points", () => {
        expect(
            normaliseAcceleratedKeyframes("clipPath", [
                "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                "polygon(20px 20px, 100% 20px, 100% 80%, 20px 80%)",
            ])
        ).toEqual([
            "polygon(0px 0px, 100% 0px, 100% 100%, 0px 100%)",
            "polygon(20px 20px, 100% 20px, 100% 80%, 20px 80%)",
        ])
    })

    test("handles a single keyframe value", () => {
        expect(
            normaliseAcceleratedKeyframes(
                "clipPath",
                "inset(0 0px 0 0px)"
            )
        ).toBe("inset(0px 0px 0px 0px)")
    })

    test("does not touch numeric or null keyframes", () => {
        expect(
            normaliseAcceleratedKeyframes("clipPath", [null, "inset(0 0)"])
        ).toEqual([null, "inset(0px 0px)"])
    })
})
