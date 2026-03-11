import { containsCSSVariable, isCSSVariableToken } from "../is-css-variable"

describe("isCSSVariableToken", () => {
    test("returns true for a CSS variable", () => {
        expect(isCSSVariableToken("--foo")).toBe(false)
        expect(isCSSVariableToken("rgba(0, 0, 0, .4)")).toBe(false)
        expect(isCSSVariableToken("var(--foo)")).toBe(true)
        expect(
            isCSSVariableToken(
                `var(--token-31a8b72b-4f05-4fb3-b778-63a7fb0d9454, hsl(224, 78%, 54%)) /* {"name":"Midnight Blue"} */`
            )
        ).toBe(true)
    })
})

describe("containsCSSVariable", () => {
    test("returns false for non-strings", () => {
        expect(containsCSSVariable(0)).toBe(false)
        expect(containsCSSVariable(100)).toBe(false)
        expect(containsCSSVariable(null)).toBe(false)
        expect(containsCSSVariable(undefined)).toBe(false)
    })

    test("returns false for strings without CSS variables", () => {
        expect(containsCSSVariable("100px")).toBe(false)
        expect(containsCSSVariable("calc(100px + 50px)")).toBe(false)
        expect(containsCSSVariable("0")).toBe(false)
    })

    test("returns true for standalone CSS variable tokens", () => {
        expect(containsCSSVariable("var(--foo)")).toBe(true)
        expect(containsCSSVariable("var(--offset)")).toBe(true)
    })

    test("returns true for calc expressions containing CSS variables", () => {
        expect(containsCSSVariable("calc(100px + var(--offset))")).toBe(true)
        expect(containsCSSVariable("calc(-100% - var(--myVar))")).toBe(true)
        expect(containsCSSVariable("calc(var(--a) + var(--b))")).toBe(true)
    })

    test("ignores CSS variables in comments", () => {
        expect(containsCSSVariable("100px /* var(--foo) */")).toBe(false)
    })
})
