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

    it("builds transform and origin values into styles, not attributes", async () => {
        const rect = svg("rect")
        const values = {
            x: motionValue(10),
            scaleX: motionValue(2),
            rotateX: motionValue(30),
            skewX: motionValue(20),
            originX: motionValue(0),
        }
        svgEffect(rect, values)

        await nextFrame()

        expect(rect.style.transform).toBe(
            "translateX(10px) scaleX(2) rotateX(30deg) skewX(20deg)"
        )
        expect(rect.style.transformOrigin).toBe("0% 50% 0")
        expect(rect.style.transformBox).toBe("fill-box")
        for (const key in values) {
            expect(rect.hasAttribute(key)).toBe(false)
        }
    })
})
