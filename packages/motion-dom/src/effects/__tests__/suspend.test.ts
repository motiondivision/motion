import { frame } from "../../frameloop"
import { motionValue } from "../../value"
import { styleEffect } from "../style"
import { svgEffect } from "../svg"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

describe("MotionValueState.suspend", () => {
    it("removes a style until its value next changes", async () => {
        const element = document.createElement("div")
        const opacity = motionValue(0.5)
        const variable = motionValue(10)
        styleEffect(element, { opacity, "--size": variable })
        await nextFrame()

        const state = styleEffect.state(element)!
        state.suspend("opacity")
        state.suspend("--size")
        await nextFrame()
        expect(element.style.opacity).toBe("")
        expect(element.style.getPropertyValue("--size")).toBe("")

        opacity.set(0.6)
        variable.set(20)
        await nextFrame()
        expect(element.style.opacity).toBe("0.6")
        expect(element.style.getPropertyValue("--size")).toBe("20")
    })

    it("leaves suspended transforms out of the transform", async () => {
        const element = document.createElement("div")
        const x = motionValue(10)
        const rotate = motionValue(45)
        styleEffect(element, { x, rotate })
        await nextFrame()
        expect(element.style.transform).toBe("translateX(10px) rotate(45deg)")

        const state = styleEffect.state(element)!
        state.suspend("x")
        await nextFrame()
        expect(element.style.transform).toBe("rotate(45deg)")

        rotate.set(90)
        await nextFrame()
        expect(element.style.transform).toBe("rotate(90deg)")

        state.suspend("rotate")
        await nextFrame()
        expect(element.style.transform).toBe("")

        x.set(20)
        await nextFrame()
        expect(element.style.transform).toBe("translateX(20px)")
    })

    it("removes transform-origin once every origin is suspended", async () => {
        const element = document.createElement("div")
        const originX = motionValue(0)
        const originY = motionValue(1)
        styleEffect(element, { originX, originY })
        await nextFrame()
        expect(element.style.transformOrigin).toBe("0% 100% 0")

        const state = styleEffect.state(element)!
        state.suspend("originX")
        await nextFrame()
        expect(element.style.transformOrigin).toBe("50% 100% 0")

        state.suspend("originY")
        await nextFrame()
        expect(element.style.transformOrigin).toBe("")
    })

    it("removes SVG attributes", async () => {
        const ns = "http://www.w3.org/2000/svg"
        const svg = document.createElementNS(ns, "svg")
        const path = document.createElementNS(ns, "path")
        svg.appendChild(path)

        const cx = motionValue(10)
        const pathLength = motionValue(0.5)
        const pathOffset = motionValue(0.25)
        svgEffect(path, { cx, pathLength, pathOffset })
        await nextFrame()
        expect(path.getAttribute("cx")).toBe("10")
        expect(path.getAttribute("stroke-dasharray")).toBe("0.5 0.5")
        expect(path.getAttribute("stroke-dashoffset")).toBe("-0.25")

        const state = svgEffect.state(path)!
        state.suspend("cx")
        state.suspend("pathLength")
        state.suspend("pathOffset")
        await nextFrame()
        expect(path.getAttribute("cx")).toBe(null)
        expect(path.getAttribute("stroke-dasharray")).toBe(null)
        expect(path.getAttribute("stroke-dashoffset")).toBe(null)

        cx.set(20)
        pathLength.set(1)
        await nextFrame()
        expect(path.getAttribute("cx")).toBe("20")
        expect(path.getAttribute("stroke-dasharray")).toBe("1 0")
    })

    it("does nothing for unbound keys", async () => {
        const element = document.createElement("div")
        styleEffect(element, { opacity: motionValue(0.5) })
        await nextFrame()

        styleEffect.state(element)!.suspend("width")
        await nextFrame()
        expect(element.style.opacity).toBe("0.5")
    })
})
