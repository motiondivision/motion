import { frame } from "../../../frameloop"
import { motionValue } from "../../../value"
import { svgEffect } from "../index"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

const svg = (tag: string) =>
    document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElement

describe("svgEffect", () => {
    it("writes attr* values as attributes in their default unit", async () => {
        const rect = svg("rect")
        svgEffect(rect, { attrX: motionValue(100), attrScale: motionValue(2) })

        await nextFrame()

        expect(rect.getAttribute("x")).toBe("100px")
        expect(rect.getAttribute("scale")).toBe("2")
    })
})
