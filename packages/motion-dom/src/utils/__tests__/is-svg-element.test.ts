import { isSVGElement } from "../is-svg-element"

describe("isSVGElement", () => {
    it("should return true for an SVG element", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        )
        expect(isSVGElement(element)).toBe(true)
    })

    it("should return true for an SVG shape element", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
        )
        expect(isSVGElement(element)).toBe(true)
    })

    it("should return false for an HTMLElement", () => {
        const element = document.createElement("div")
        expect(isSVGElement(element)).toBe(false)
    })

    it("should return false for a non-SVG element", () => {
        const element = "not an SVG element"
        expect(isSVGElement(element)).toBe(false)
    })

    it("should return false for a null element", () => {
        const element = null
        expect(isSVGElement(element)).toBe(false)
    })
})
