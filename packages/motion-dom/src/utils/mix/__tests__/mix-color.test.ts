import { mixColor, mixLinearColor } from "../color"

test("mixColor hex", () => {
    expect(mixColor("#fff", "#000")(0.5)).toBe("rgba(180, 180, 180, 1)")
})

test("mixColor hex with alpha", () => {
    expect(mixColor("#ffffff00", "#000000ff")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor hex with some alpha", () => {
    expect(mixColor("#ffffff00", "#000000")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor rgba", () => {
    expect(mixColor("rgba(0, 0, 0, 0)", "rgba(255, 255, 255, 1)")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor rgba out of bounds", () => {
    expect(mixColor("rgba(0, 0, 0, 0)", "rgba(255, 255, 255, 1)")(2)).toBe(
        "rgba(255, 255, 255, 1)"
    )
    expect(mixColor("rgba(0, 0, 0, 0)", "rgba(255, 255, 255, 1)")(-1)).toBe(
        "rgba(0, 0, 0, 0)"
    )
})

test("mixColor rgb", () => {
    expect(mixColor("rgb(0, 0, 0)", "rgba(255, 255, 255)")(0.5)).toBe(
        "rgba(180, 180, 180, 1)"
    )
})

test("mixColor rgb out of bounds", () => {
    expect(mixColor("rgb(0, 0, 0)", "rgba(255, 255, 255)")(2)).toBe(
        "rgba(255, 255, 255, 1)"
    )
    expect(mixColor("rgb(0, 0, 0)", "rgba(255, 255, 255)")(-1)).toBe(
        "rgba(0, 0, 0, 1)"
    )
})

test("mixColor hsla", () => {
    expect(mixColor("hsla(0, 0%, 0%, 0)", "hsla(0, 0%, 100%, 1)")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )

    expect(
        mixColor(
            "hsla(177, 37.4978%, 76.66804%, 1)",
            "hsla(0, 0%, 100%, 1)"
        )(0.5)
    ).toBe("rgba(218, 237, 236, 1)")
})

test("mixColor hsla out of bounds", () => {
    expect(mixColor("hsla(120, 0%, 0%, 0)", "hsla(360, 100%, 50%, 1)")(2)).toBe(
        "rgba(255, 0, 0, 1)"
    )
    expect(
        mixColor("hsla(120, 0%, 0%, 0)", "hsla(360, 100%, 50%, 1)")(-1)
    ).toBe("rgba(0, 0, 0, 0)")
})

test("mixColor hsl", () => {
    expect(mixColor("hsl(120, 0%, 0%)", "hsl(360, 100%, 50%)")(0.5)).toBe(
        "rgba(180, 0, 0, 1)"
    )
})

test("mixColor hsl out of bounds", () => {
    expect(mixColor("hsl(120, 0%, 0%)", "hsl(360, 100%, 50%)")(2)).toBe(
        "rgba(255, 0, 0, 1)"
    )
    expect(mixColor("hsl(120, 0%, 0%)", "hsl(360, 100%, 50%)")(-1)).toBe(
        "rgba(0, 0, 0, 1)"
    )
})

test("mixColor rgb to hex", () => {
    expect(mixColor("rgb(255, 255, 255)", "#000")(0.5)).toBe(
        "rgba(180, 180, 180, 1)"
    )
})

test("mixColor hsla to rgba", () => {
    expect(mixColor("hsla(0, 0, 0, 0)", "rgba(255, 255, 255, 1)")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor hsla to hex", () => {
    expect(mixColor("hsla(0, 0, 0, 0)", "#fff")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor hex to hsla", () => {
    expect(mixColor("#fff", "hsla(0, 0, 0, 0)")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor rgba to hsla", () => {
    expect(mixColor("rgba(255, 255, 255, 1)", "hsla(0, 0, 0, 0)")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor rgba with slash to rgba without", () => {
    expect(mixColor("rgb(255, 255, 255 / 1)", "rgba(0, 0, 0, 0)")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("mixColor rgba with slash (without slash spaces) to rgba without", () => {
    expect(mixColor("rgb(255 255 255/1)", "rgba(0, 0, 0, 0)")(0.5)).toBe(
        "rgba(180, 180, 180, 0.5)"
    )
})

test("doesn't return NaN", () => {
    expect(mixLinearColor(255, 0, 2)).not.toBeNaN()
})

test("mixColor mixes immediately with unknown color", () => {
    expect(mixColor("red", "rgba(0, 0, 0, 0)")(0)).toBe("red")
    expect(mixColor("red", "rgba(0, 0, 0, 0)")(0.5)).toBe("rgba(0, 0, 0, 0)")
    expect(mixColor("red", "rgba(0, 0, 0, 0)")(1)).toBe("rgba(0, 0, 0, 0)")
})
