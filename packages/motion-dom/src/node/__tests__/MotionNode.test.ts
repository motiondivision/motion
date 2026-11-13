import { animateElement } from "../../animation/animate/element"
import { styleEffect } from "../../effects/style"
import { svgEffect } from "../../effects/svg"
import { frame } from "../../frameloop"
import { HTMLVisualElement } from "../../render/html/HTMLVisualElement"
import { nodeStore } from "../../render/store"
import { SVGVisualElement } from "../../render/svg/SVGVisualElement"
import { buildVisualProps } from "../../render/utils/build-props"
import { getSVGRender } from "../../render/svg/utils/get-render"
import { VisualElement } from "../../render/VisualElement"
import { motionValue } from "../../value"
import { getStyleRender } from "../../effects/style"
import { MotionNode } from "../MotionNode"

const nextFrame = () =>
    new Promise<void>((resolve) => frame.postRender(() => resolve()))

/**
 * Counts the writes to each style of an element.
 */
function countWrites(element: HTMLElement | SVGElement) {
    const writes: Record<string, number> = {}
    const { style } = element
    for (const key of ["opacity", "transform", "backgroundColor"]) {
        let value = (style as any)[key]
        Object.defineProperty(style, key, {
            get: () => value,
            set: (v) => {
                writes[key] = (writes[key] || 0) + 1
                value = v
            },
            configurable: true,
        })
    }
    return writes
}

const createVisualElement = (
    Element: typeof HTMLVisualElement | typeof SVGVisualElement,
    latestValues = {},
    props = {}
): VisualElement<any> =>
    new Element(
        { props, presenceContext: null, visualState: { latestValues } },
        {}
    )

describe("MotionNode", () => {
    it("writes only the key that changed", async () => {
        const element = document.createElement("div")
        const opacity = motionValue(1)
        const x = motionValue(0)
        styleEffect(element, { opacity, x })
        await nextFrame()

        const writes = countWrites(element)
        opacity.set(0.5)
        await nextFrame()

        expect(writes).toEqual({ opacity: 1 })
        expect(String(element.style.opacity)).toBe("0.5")
    })

    it("writes a shared key once per frame", async () => {
        const element = document.createElement("div")
        const x = motionValue(0)
        const scale = motionValue(1)
        styleEffect(element, { x, scale })
        await nextFrame()

        const writes = countWrites(element)
        x.set(10)
        scale.set(2)
        await nextFrame()

        expect(writes).toEqual({ transform: 1 })
        expect(element.style.transform).toBe("translateX(10px) scale(2)")
    })

    it("gives an element one node for styleEffect() and animate()", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)
        const opacity = motionValue(0.5)
        styleEffect(element, { opacity })

        const node = nodeStore.get(element)!
        expect(node).toBeInstanceOf(MotionNode)
        expect(node).not.toBeInstanceOf(VisualElement)

        const [animation] = animateElement(
            element,
            { x: [0, 100] },
            { duration: 10, ease: "linear" }
        )

        expect(nodeStore.get(element)).toBe(node)
        expect(node.getValue("opacity")).toBe(opacity)
        expect(node.getValue("x")).toBeDefined()

        animation.stop()
        element.remove()
    })

    it("lets styleEffect() bind to the node of a motion component", async () => {
        const element = document.createElement("div")
        const visualElement = createVisualElement(HTMLVisualElement, {
            opacity: 0.5,
        })
        visualElement.mount(element)

        const x = motionValue(20)
        styleEffect(element, { x })

        expect(nodeStore.get(element)).toBe(visualElement)
        expect(visualElement.getValue("x")).toBe(x)

        await nextFrame()
        expect(element.style.transform).toBe("translateX(20px)")

        visualElement.unmount()
    })

    it("keeps a node of its own for an effect that writes keys differently", () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        )
        const visualElement = createVisualElement(SVGVisualElement)
        visualElement.mount(element)

        svgEffect(element, { cx: motionValue(10) })

        expect(nodeStore.get(element)).toBe(visualElement)
        expect(visualElement.getValue("cx")).toBeUndefined()
        expect(svgEffect.state(element)).not.toBe(visualElement)

        visualElement.unmount()
    })

    it("writes a value that has no motion value when the node renders", () => {
        const element = document.createElement("div")
        const visualElement = createVisualElement(HTMLVisualElement, {
            opacity: 0.5,
        })
        visualElement.mount(element)

        visualElement.setStaticValue("rotate", 45)
        visualElement.render()
        expect(element.style.opacity).toBe("0.5")
        expect(element.style.transform).toBe("rotate(45deg)")

        visualElement.setStaticValue("rotate", 0)
        visualElement.render()
        expect(element.style.transform).toBe("none")

        visualElement.unmount()
    })

    it("doesn't write a component's values when it first mounts", async () => {
        const element = document.createElement("div")
        const writes = countWrites(element)
        const opacity = motionValue(0.5)
        const visualElement = createVisualElement(
            HTMLVisualElement,
            { opacity: 0.5 },
            { style: { opacity } }
        )
        visualElement.mount(element)
        await nextFrame()
        expect(writes).toEqual({})

        opacity.set(1)
        await nextFrame()
        expect(writes).toEqual({ opacity: 1 })

        visualElement.unmount()
    })

    it("writes transform again when one of its keys is removed", async () => {
        const element = document.createElement("div")
        const x = motionValue(10)
        const y = motionValue(20)
        const visualElement = createVisualElement(HTMLVisualElement)
        visualElement.mount(element)
        visualElement.addValue("x", x)
        visualElement.addValue("y", y)
        visualElement.render()
        expect(element.style.transform).toBe(
            "translateX(10px) translateY(20px)"
        )

        visualElement.removeValue("x")
        await nextFrame()
        expect(element.style.transform).toBe("translateY(20px)")

        visualElement.removeValue("y")
        await nextFrame()
        expect(element.style.transform).toBe("none")

        visualElement.unmount()
    })

    it("stops writing after unmount and writes again after remount", async () => {
        const element = document.createElement("div")
        const opacity = motionValue(0.5)
        const visualElement = createVisualElement(HTMLVisualElement)
        visualElement.addValue("opacity", opacity)
        visualElement.mount(element)
        visualElement.unmount()

        opacity.set(0.2)
        await nextFrame()
        expect(element.style.opacity).toBe("")

        const next = document.createElement("div")
        visualElement.mount(next)
        opacity.set(0.8)
        await nextFrame()
        expect(next.style.opacity).toBe("0.8")
        expect(element.style.opacity).toBe("")

        visualElement.unmount()
    })

    it("writes a transformTemplate that was scheduled before mount", () => {
        const element = document.createElement("div")
        const visualElement = createVisualElement(
            HTMLVisualElement,
            {},
            { transformTemplate: () => "translateX(10px)" }
        )

        visualElement.scheduleRender()
        visualElement.mount(element)
        visualElement.render()

        expect(element.style.transform).toBe("translateX(10px)")

        visualElement.unmount()
    })

    it("has the origin of a value that is animating but not yet written", async () => {
        const element = document.createElement("div")
        element.style.opacity = "0.5"
        document.body.appendChild(element)

        animateElement(element, { opacity: 1 }, { delay: 1, duration: 1 })
        await nextFrame()
        await nextFrame()

        expect(nodeStore.get(element)!.latestValues.opacity).toBe(0.5)

        element.remove()
    })

    it("writes an SVG component's values as attributes, and transforms as styles", async () => {
        const element = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
        )
        const visualElement = createVisualElement(SVGVisualElement, {
            cx: 10,
            strokeWidth: 2,
            x: 5,
            pathLength: 0.5,
        })
        visualElement.mount(element)
        visualElement.render()

        expect(element.getAttribute("cx")).toBe("10")
        expect(element.getAttribute("stroke-width")).toBe("2")
        expect(element.getAttribute("pathLength")).toBe("1")
        expect(element.getAttribute("stroke-dasharray")).toBe("0.5 1")
        expect(element.getAttribute("stroke-dashoffset")).toBe("0")
        expect(element.style.transform).toBe("translateX(5px)")
        expect(element.style.transformOrigin).toBe("50% 50%")
        expect(element.style.transformBox).toBe("fill-box")

        visualElement.unmount()
    })
})

describe("buildVisualProps", () => {
    it("builds the styles the node writes", () => {
        const { style } = buildVisualProps(
            getStyleRender,
            { x: 10, scale: 2, opacity: 0.5, width: 100, "--size": 3, originX: 0 },
            {}
        )

        expect({ ...style }).toEqual({
            transform: "translateX(10px) scale(2)",
            transformOrigin: "0% 50% 0",
            opacity: 0.5,
            width: "100px",
            "--size": 3,
        })
    })

    it("calls transformTemplate without transforms", () => {
        const { style } = buildVisualProps(
            getStyleRender,
            { opacity: 1 },
            { transformTemplate: (_: any, generated: string) => `a ${generated}` }
        )

        expect(style.transform).toBe("a ")
    })

    it("builds SVG attributes with the names a framework renders", () => {
        const { style, attrs } = buildVisualProps(
            getSVGRender,
            { strokeWidth: 2, attrX: 4, pathLength: 0.5, pathOffset: 0.25, y: 5 },
            {},
            "path"
        )

        expect(attrs).toEqual({
            strokeWidth: 2,
            x: 4,
            pathLength: 1,
            strokeDashoffset: "-0.25",
            strokeDasharray: "0.5 1",
        })
        expect({ ...style }).toEqual({
            transform: "translateY(5px)",
            transformOrigin: "50% 50%",
            transformBox: "fill-box",
        })
    })

    it("treats the <svg> tag as HTML, bar viewBox", () => {
        const { style, attrs } = buildVisualProps(
            getSVGRender,
            { viewBox: "0 0 10 10", x: 5, opacity: 0.5 },
            {},
            "svg"
        )

        expect(attrs).toEqual({ viewBox: "0 0 10 10" })
        expect({ ...style }).toEqual({
            transform: "translateX(5px)",
            opacity: 0.5,
        })
    })
})
