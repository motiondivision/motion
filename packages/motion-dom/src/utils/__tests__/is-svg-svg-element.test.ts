import { isSVGSVGElement } from "../is-svg-svg-element"

describe("isSVGSVGElement", () => {
    it("should return true for an SVGSVGElement", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        )
        expect(isSVGSVGElement(element)).toBe(true)
    })

    it("should return false for an SVG shape element", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "rect"
        )
        expect(isSVGSVGElement(element)).toBe(false)
    })

    it("should return false for an HTMLElement", () => {
        const element = document.createElement("div")
        expect(isSVGSVGElement(element)).toBe(false)
    })

    it("should return false for a non-SVG element", () => {
        const element = "not an SVG element"
        expect(isSVGSVGElement(element)).toBe(false)
    })

    it("should return false for a null element", () => {
        const element = null
        expect(isSVGSVGElement(element)).toBe(false)
    })
})
