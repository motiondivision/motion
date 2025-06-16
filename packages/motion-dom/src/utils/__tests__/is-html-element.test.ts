import { isHTMLElement } from "../is-html-element"

describe("isHTMLElement", () => {
    it("should return true for an HTMLElement", () => {
        const element = document.createElement("div")
        expect(isHTMLElement(element)).toBe(true)
    })

    it("should return false for a non-HTMLElement", () => {
        const element = "not an HTMLElement"
        expect(isHTMLElement(element)).toBe(false)
    })

    it("should return false for an SVG element", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        )
        expect(isHTMLElement(element)).toBe(false)
    })

    it("should return false for a null element", () => {
        const element = null
        expect(isHTMLElement(element)).toBe(false)
    })
})
