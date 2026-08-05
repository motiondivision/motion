import { renderSVG } from "../render"

function createState(attrs: Record<string, number | string>) {
    return {
        style: {},
        vars: {},
        transform: {},
        transformOrigin: {},
        attrs,
    }
}

describe("renderSVG", () => {
    test("clears WAAPI-committed inline styles that would override attributes", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "foreignObject"
        )
        element.style.opacity = "0"

        renderSVG(element, createState({ opacity: 1 }))

        expect(element.getAttribute("opacity")).toBe("1")
        expect(element.style.opacity).toBe("")
    })

    test("leaves unrelated inline styles intact", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        )
        element.style.transform = "translateX(10px)"

        renderSVG(element, createState({ opacity: 0.5 }))

        expect(element.getAttribute("opacity")).toBe("0.5")
        expect(element.style.transform).toBe("translateX(10px)")
    })
})
