import { mix } from "../../../utils/mix"
import { interpolate } from "../../../utils/interpolate"
import { transform } from "../../../utils/transform"
import { color } from "../color"
import { complex } from "../complex"
import { filter } from "../complex/filter"
import { colorRegex } from "../utils/color-regex"
import { floatRegex } from "../utils/float-regex"
import { singleColorRegex } from "../utils/single-color-regex"

/**
 * CSS numbers allow an exponent (css-values-4 #numbers) and JavaScript
 * prints small numbers this way, so 1e-7 must be one number, not 1 and -7.
 */
describe("numbers in exponent notation", () => {
    test("mix complex values (#4072)", () => {
        expect(
            mix(
                "translateX(1e-7px) rotate(10deg)",
                "translateX(100px) rotate(20deg)"
            )(0.5)
        ).toBe("translateX(50px) rotate(15deg)")
    })

    test("interpolate filters (#4072)", () => {
        expect(interpolate([0, 1], ["blur(2.5e-7px)", "blur(4px)"])(0.5)).toBe(
            "blur(2px)"
        )
    })

    test("transform shadows with exponent alpha (#4072)", () => {
        expect(
            transform(
                [0, 1],
                [
                    "0px 1.6e-8px 3.2e-8px rgba(161, 0, 246, 6.4e-10)",
                    "0px 10px 20px rgba(0, 0, 0, 0.4)",
                ]
            )(0.25)
        ).toBe(
            transform(
                [0, 1],
                [
                    "0px 0px 0px rgba(161, 0, 246, 0)",
                    "0px 10px 20px rgba(0, 0, 0, 0.4)",
                ]
            )(0.25)
        )
    })

    test("floatRegex", () => {
        expect("1e-7px 2.5E+3 .5e2 -3e1 1e5".match(floatRegex)).toEqual([
            "1e-7",
            "2.5E+3",
            ".5e2",
            "-3e1",
            "1e5",
        ])
        // e without digits is a unit or identifier, not an exponent
        expect("1em 2ex 2e 3e-".match(floatRegex)).toEqual(["1", "2", "2", "3"])
    })

    test("complex parses exponents as one number", () => {
        expect(complex.parse("translateX(1e-7px) rotate(10deg)")).toEqual([
            1e-7, 10,
        ])
        expect(complex.parse("1.5e+2px 2E3px")).toEqual([150, 2000])
        expect(complex.parse("1em 2ex 3e")).toEqual([1, 2, 3])
        expect(complex.parse("translate3d(1e2px, 0, 0)")).toEqual([100, 0, 0])
        expect(
            complex.createTransformer("translateX(1e-7px) rotate(10deg)")([
                2, 3,
            ])
        ).toBe("translateX(2px) rotate(3deg)")
    })

    test("hex colours aren't read as exponents", () => {
        expect(complex.parse("#1e3 1e3px")).toEqual([
            { red: 17, green: 238, blue: 51, alpha: 1 },
            1000,
        ])
        expect(complex.parse("0px 0px #1e3e5f")).toEqual([
            0,
            0,
            { red: 30, green: 62, blue: 95, alpha: 1 },
        ])
    })

    test("CSS variables keep their names", () => {
        expect(complex.parse("var(--e1e2) 1e2px")).toEqual(["var(--e1e2)", 100])
        expect(complex.parse("var(--a, 1e2px) 2px")).toEqual([
            "var(--a, 1e2px)",
            2,
        ])
    })

    test("colours with exponents", () => {
        expect(singleColorRegex.test("rgba(161, 0, 246, 6.4e-10)")).toBe(true)
        expect(singleColorRegex.test("rgb(1e2, 2E1, 0)")).toBe(true)
        expect(singleColorRegex.test("rgba(1e2 2e1 0 / 5e-1)")).toBe(true)
        expect(singleColorRegex.test("hsla(1e2, 5e1%, 1e-3%, 1e-1)")).toBe(true)
        expect(singleColorRegex.test("rgba(0, 0, 0, e5)")).toBe(false)
        expect("0px 1px rgba(161, 0, 246, 6.4e-10)".match(colorRegex)).toEqual([
            "rgba(161, 0, 246, 6.4e-10)",
        ])

        expect(color.parse("rgba(1e2, 2E1, 0, 6.4e-10)")).toEqual({
            red: 100,
            green: 20,
            blue: 0,
            alpha: 6.4e-10,
        })
        expect(color.parse("hsla(1e2, 5e1%, 1e-3%, 5e-1)")).toEqual({
            hue: 100,
            saturation: 50,
            lightness: 0.001,
            alpha: 0.5,
        })
    })

    test("filter animatable none", () => {
        expect(filter.getAnimatableNone("blur(2.5e-7px)")).toBe("blur(0px)")
        expect(filter.getAnimatableNone("brightness(1e-1)")).toBe(
            "brightness(1)"
        )
    })
})
