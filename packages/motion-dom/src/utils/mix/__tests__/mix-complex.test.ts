import { mixComplex } from "../complex"

test("mixComplex", () => {
    expect(mixComplex("20px", "10px")(0.5)).toBe("15px")
    expect(
        mixComplex(
            "20px, rgba(0, 0, 0, 0)",
            "10px, rgba(255, 255, 255, 1)"
        )(0.5)
    ).toBe("15px, rgba(180, 180, 180, 0.5)")
    expect(mixComplex("20px, #0000", "10px, #ffff")(0.5)).toBe(
        "15px, rgba(180, 180, 180, 0.5)"
    )
})

test("mixComplex gracefully handles numbers", () => {
    expect(mixComplex(20, "10")(0.5)).toBe("15")
})

test("mixComplex errors", () => {
    expect(mixComplex("hsla(100%, 100, 100, 1)", "#fff")(0)).toBe(
        "rgba(255, 255, 255, 1)"
    )
    expect(mixComplex("hsla(100%, 100, 100, 1)", "#fff")(0.1)).toBe(
        "rgba(255, 255, 255, 1)"
    )
})

test("mixComplex mixes var() and unit types", () => {
    expect(mixComplex("var(--test) 0px", "var(--test) 20px")(0.5)).toBe(
        "var(--test) 10px"
    )
    expect(mixComplex("var(--test-1) 10px", "var(--test-9) 60px")(0.5)).toBe(
        "var(--test-9) 35px"
    )
})

test("mixComplex can interpolate out-of-order values", () => {
    expect(mixComplex("#fff 0px 0px", "20px 0px #000")(0.5)).toBe(
        "10px 0px rgba(180, 180, 180, 1)"
    )
})

test("mixComplex can animate from a value-less prop", () => {
    expect(mixComplex("#fff 0 0px", "#000 20px 0px")(0.5)).toBe(
        "rgba(180, 180, 180, 1) 10px 0px"
    )
})

test("mixComplex can animate from a value with extra zeros", () => {
    expect(mixComplex("#fff 0 0px 0px", "20px 0px #000")(0.5)).toBe(
        "10px 0px rgba(180, 180, 180, 1)"
    )
})

test("mixComplex will only interpolate values outside of CSS variables", () => {
    const mixer = mixComplex(
        "#fff 0 var(--grey, 0px) 10px",
        "#000 0 var(--grey, 10px) 0px"
    )
    expect(mixer(0)).toBe("rgba(255, 255, 255, 1) 0 var(--grey, 0px) 10px")
    expect(mixer(0.5)).toBe("rgba(180, 180, 180, 1) 0 var(--grey, 10px) 5px")
    expect(mixer(1)).toBe("rgba(0, 0, 0, 1) 0 var(--grey, 10px) 0px")
})
