import { MotionValueState } from "../MotionValueState"
import { renderSVGValues } from "../svg/render"

const createSVGElement = (tag: string) =>
    document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElement

describe("renderSVGValues", () => {
    it("composes pathRotation into transform, not path attributes", () => {
        const element = createSVGElement("path")
        const state = new MotionValueState({ rotate: 45, pathRotation: 90 })

        renderSVGValues(element, state)

        expect(element.style.transform).toBe("rotate(45deg) rotate(90deg)")
        expect(element.getAttribute("pathLength")).toBeNull()
        expect(element.getAttribute("stroke-dasharray")).toBeNull()
    })

    it("routes values to styles, attributes and composed slots", () => {
        const element = createSVGElement("circle")
        const state = new MotionValueState({
            cx: 100,
            fill: "red",
            attrScale: 2,
            x: 50,
            originX: 0.25,
            pathLength: 0.5,
            pathOffset: 0.25,
        })

        renderSVGValues(element, state)

        expect(element.getAttribute("cx")).toBe("100")
        expect(element.style.fill).toBe("red")
        expect(element.getAttribute("scale")).toBe("2")
        expect(element.style.transform).toBe("translateX(50px)")
        expect(element.style.transformBox).toBe("fill-box")
        expect(element.style.transformOrigin).toBe("25% 50% 0")
        expect(element.getAttribute("pathLength")).toBe("1")
        expect(element.getAttribute("stroke-dashoffset")).toBe("-0.25")
        expect(element.getAttribute("stroke-dasharray")).toBe("0.5 1")
    })

    it("defaults transform-origin to the element median for transforms", () => {
        const element = createSVGElement("rect")
        const state = new MotionValueState({ rotate: 45 })

        renderSVGValues(element, state)

        expect(element.style.transformOrigin).toBe("50% 50%")
    })

    it("respects a user-provided transformBox", () => {
        const element = createSVGElement("rect")
        const state = new MotionValueState({
            rotate: 45,
            transformBox: "view-box",
        })

        renderSVGValues(element, state)

        expect(element.style.transformBox).toBe("view-box")
    })
})
