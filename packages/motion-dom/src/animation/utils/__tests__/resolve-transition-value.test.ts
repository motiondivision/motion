import { parseTimeValue, resolveTransitionValue } from "../resolve-transition-value"

describe("parseTimeValue", () => {
    test("parses seconds correctly", () => {
        expect(parseTimeValue("2s")).toBe(2000)
        expect(parseTimeValue("0.5s")).toBe(500)
        expect(parseTimeValue("1.5s")).toBe(1500)
        expect(parseTimeValue(".3s")).toBe(300)
    })

    test("parses milliseconds correctly", () => {
        expect(parseTimeValue("500ms")).toBe(500)
        expect(parseTimeValue("1000ms")).toBe(1000)
        expect(parseTimeValue("250ms")).toBe(250)
    })

    test("parses plain numbers as seconds and converts to milliseconds", () => {
        expect(parseTimeValue("0.3")).toBe(300)
        expect(parseTimeValue("2")).toBe(2000)
        expect(parseTimeValue("0.5")).toBe(500)
    })

    test("returns undefined for invalid values", () => {
        expect(parseTimeValue("invalid")).toBeUndefined()
        expect(parseTimeValue("")).toBeUndefined()
        expect(parseTimeValue("abc")).toBeUndefined()
    })
})

describe("resolveTransitionValue", () => {
    let mockElement: HTMLElement

    beforeEach(() => {
        mockElement = document.createElement("div")
        document.body.appendChild(mockElement)
    })

    afterEach(() => {
        document.body.removeChild(mockElement)
    })

    test("converts number values from seconds to milliseconds", () => {
        expect(resolveTransitionValue(0.3, mockElement, 0)).toBe(300)
        expect(resolveTransitionValue(0, mockElement, 100)).toBe(0)
        expect(resolveTransitionValue(1.5, mockElement, 0)).toBe(1500)
        expect(resolveTransitionValue(2, mockElement, 0)).toBe(2000)
    })

    test("returns default value for undefined", () => {
        expect(resolveTransitionValue(undefined, mockElement, 300)).toBe(300)
        expect(resolveTransitionValue(undefined, mockElement, 0)).toBe(0)
    })

    test("parses time string values", () => {
        expect(resolveTransitionValue("2s", mockElement, 0)).toBe(2000)
        expect(resolveTransitionValue("500ms", mockElement, 0)).toBe(500)
        expect(resolveTransitionValue("0.3s", mockElement, 0)).toBe(300)
    })

    test("resolves CSS variables", () => {
        mockElement.style.setProperty("--duration", "2s")
        expect(resolveTransitionValue("var(--duration)", mockElement, 0)).toBe(2000)

        mockElement.style.setProperty("--delay", "500ms")
        expect(resolveTransitionValue("var(--delay)", mockElement, 0)).toBe(500)
    })

    test("resolves CSS variables with numeric values (seconds)", () => {
        mockElement.style.setProperty("--duration", "0.5")
        expect(resolveTransitionValue("var(--duration)", mockElement, 0)).toBe(500)
    })

    test("uses fallback for undefined CSS variables", () => {
        expect(resolveTransitionValue("var(--undefined-var)", mockElement, 300)).toBe(300)
    })

    test("resolves CSS variable with inline fallback", () => {
        expect(resolveTransitionValue("var(--undefined-var, 1s)", mockElement, 0)).toBe(1000)
        expect(resolveTransitionValue("var(--undefined-var, 500ms)", mockElement, 0)).toBe(500)
    })
})
