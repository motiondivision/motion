import { styleEffect } from "../../../effects/style"
import { svgEffect } from "../../../effects/svg"
import { frame } from "../../../frameloop"
import { HTMLVisualElement } from "../../../render/html/HTMLVisualElement"
import { motionValue } from "../../../value"
import { animateElement, handOffElementState } from "../element"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
    })
}

function createVisualElement() {
    return new HTMLVisualElement({
        props: {},
        presenceContext: null,
        visualState: {
            latestValues: {},
            renderState: {
                transform: {},
                transformOrigin: {},
                style: {},
                vars: {},
            },
        },
    })
}

describe("animateElement", () => {
    it("reads the initial value from the DOM before the first frame", async () => {
        const element = document.createElement("div")
        element.style.opacity = "0"

        const [animation] = animateElement(
            element,
            { opacity: 1 },
            { duration: 10, ease: "linear" }
        )

        // Reads are batched into frame.read, so nothing is read synchronously
        expect(styleEffect.get(element, "opacity")!.get()).toBe(undefined)

        await nextFrame()
        await nextFrame()

        const opacity = parseFloat(element.style.opacity)
        expect(opacity).toBeGreaterThanOrEqual(0)
        expect(opacity).toBeLessThan(0.1)

        animation.stop()
    })

    it("animates from a supplied first keyframe without reading the DOM", async () => {
        const element = document.createElement("div")
        const read = jest.spyOn(window, "getComputedStyle")

        const [animation] = animateElement(
            element,
            { opacity: [0.5, 1] },
            { duration: 0.05 }
        )

        await animation.finished
        await nextFrame()

        expect(read).not.toHaveBeenCalled()
        expect(element.style.opacity).toBe("1")

        read.mockRestore()
    })

    it("renders transforms, styles and CSS variables via styleEffect", async () => {
        const element = document.createElement("div")
        element.style.width = "10px"

        const animations = animateElement(
            element,
            { x: 100, rotate: 45, width: "50px", "--progress": 1 },
            { duration: 0.05 }
        )

        await Promise.all(animations.map((animation) => animation.finished))
        await nextFrame()

        expect(element.style.transform).toBe("translateX(100px) rotate(45deg)")
        expect(element.style.width).toBe("50px")
        expect(element.style.getPropertyValue("--progress")).toBe("1")
        expect(styleEffect.get(element, "x")!.get()).toBe(100)
        expect(styleEffect.get(element, "width")!.get()).toBe("50px")
    })

    it("animates a value already bound with styleEffect() rather than creating a second one", async () => {
        const element = document.createElement("div")
        const x = motionValue(0)
        styleEffect(element, { x })

        const [animation] = animateElement(
            element,
            { x: 100 },
            { duration: 0.05 }
        )

        expect(styleEffect.get(element, "x")).toBe(x)
        expect(x.isAnimating()).toBe(true)

        await animation.finished
        await nextFrame()

        expect(x.get()).toBe(100)
        expect(element.style.transform).toBe("translateX(100px)")
    })

    it("shares one transform render between styleEffect() and animate()", async () => {
        const element = document.createElement("div")
        const y = motionValue(50)
        styleEffect(element, { y })

        const [animation] = animateElement(
            element,
            { x: [0, 100] },
            { duration: 0.05 }
        )

        await animation.finished
        await nextFrame()

        // A second state would have written transform twice, the last
        // one winning with only its own keys
        expect(element.style.transform).toBe("translateX(100px) translateY(50px)")

        y.set(20)
        await nextFrame()
        expect(element.style.transform).toBe("translateX(100px) translateY(20px)")
    })

    it("owns the motion values so WAAPI can be used", () => {
        const element = document.createElement("div")

        animateElement(element, { opacity: 1 }, { duration: 0.05 })

        const value = styleEffect.get(element, "opacity")!
        expect(value.owner!.current).toBe(element)
        expect(value.owner!.getProps()).toEqual({})
    })

    it("skips values already at their target", async () => {
        const element = document.createElement("div")
        styleEffect(element, { opacity: motionValue(1) })

        const animations = animateElement(
            element,
            { opacity: 1 },
            { duration: 0.05 }
        )

        expect(animations.length).toBe(0)
    })

    it("applies transitionEnd when the animations finish", async () => {
        const element = document.createElement("div")

        const [animation] = animateElement(
            element,
            { opacity: [1, 0], transitionEnd: { display: "none" } },
            { duration: 0.05 }
        )

        await animation.finished
        await nextFrame()
        await nextFrame()

        expect(element.style.opacity).toBe("0")
        expect(element.style.display).toBe("none")
    })

    it("converts units by measuring the element", async () => {
        const element = document.createElement("div")
        element.style.width = "50px"
        document.body.appendChild(element)

        /**
         * JSDOM doesn't lay out, so the resolver's computed-style reads
         * return whatever inline value is set. Make the measurement of
         * the % target report 100px so the animation runs 50px -> 100px.
         */
        const style = window.getComputedStyle
        jest.spyOn(window, "getComputedStyle").mockImplementation(
            (target: Element) => {
                const computed = style(target)
                return new Proxy(computed, {
                    get: (obj, key) =>
                        key === "width" && element.style.width === "100%"
                            ? "100px"
                            : (obj as any)[key],
                })
            }
        )

        const [animation] = animateElement(
            element,
            { width: "100%" },
            { duration: 10, ease: "linear" }
        )

        await nextFrame()
        await nextFrame()

        // The target is measured in px and animated as a number
        const width = styleEffect.get(element, "width")!.get()
        expect(typeof width).toBe("number")
        expect(width).toBeGreaterThanOrEqual(50)
        expect(width).toBeLessThan(51)
        expect(element.style.width.endsWith("px")).toBe(true)

        animation.stop()
        jest.restoreAllMocks()
        element.remove()
    })

    it("hands its values to a VisualElement that takes over the element", async () => {
        const element = document.createElement("div")
        document.body.appendChild(element)

        const [animation] = animateElement(
            element,
            { x: [0, 100], opacity: [1, 0.5] },
            { duration: 10, ease: "linear" }
        )
        const state = styleEffect.state(element)!
        const x = styleEffect.get(element, "x")!
        expect(state.transformKeys).toEqual(["x"])

        // As animateLayout() does when it first meets the element
        const visualElement = createVisualElement()
        handOffElementState(element, visualElement)
        visualElement.mount(element)

        // The same values now live on the VisualElement...
        expect(visualElement.getValue("x")).toBe(x)
        expect(visualElement.getValue("opacity")).toBeDefined()
        // ...not the style effect's derived transform
        expect(visualElement.getValue("transform")).toBeUndefined()
        // ...and the style effect has let go of them
        expect(styleEffect.get(element, "x")).toBeUndefined()
        expect(styleEffect.get(element, "transform")).toBeUndefined()
        expect(state.transformKeys).toBeUndefined()
        expect(state.transformValues).toBeUndefined()

        // The VisualElement renders them from here
        x.jump(40)
        await nextFrame()
        expect(visualElement.latestValues.x).toBe(40)
        expect(element.style.transform).toBe("translateX(40px)")

        animation.stop()
        visualElement.unmount()
        element.remove()
    })

    it("hands over values bound directly with styleEffect() too", () => {
        const element = document.createElement("div")
        const rotate = motionValue(10)
        styleEffect(element, { rotate })

        const visualElement = createVisualElement()
        handOffElementState(element, visualElement)

        expect(visualElement.getValue("rotate")).toBe(rotate)
        expect(styleEffect.get(element, "rotate")).toBeUndefined()
    })

    it("is a no-op for elements with nothing bound", () => {
        const element = document.createElement("div")
        const visualElement = createVisualElement()

        expect(() => handOffElementState(element, visualElement)).not.toThrow()
        expect(styleEffect.state(element)).toBeUndefined()
    })

    describe("on SVG elements", () => {
        const svg = (tag: string) =>
            document.createElementNS("http://www.w3.org/2000/svg", tag)

        it("draws paths with pathLength", async () => {
            const path = svg("path")

            const [animation] = animateElement(
                path,
                { pathLength: [0, 1] },
                { duration: 0.05 }
            )

            await animation.finished
            await nextFrame()

            expect(path.getAttribute("pathLength")).toBe("1")
            expect(path.getAttribute("stroke-dasharray")).toBe("1 0")
            expect(svgEffect.get(path, "pathLength")!.get()).toBe(1)
            expect(styleEffect.get(path, "pathLength")).toBeUndefined()
        })

        it("reads attribute origins and writes attr* values as attributes", async () => {
            const rect = svg("rect")
            rect.setAttribute("x", "10")

            const [animation] = animateElement(
                rect,
                { attrX: 50 },
                { duration: 10, ease: "linear" }
            )

            await nextFrame()
            await nextFrame()

            const x = svgEffect.get(rect, "attrX")!.get()
            expect(x).toBeGreaterThanOrEqual(10)
            expect(x).toBeLessThan(11)
            expect(parseFloat(rect.getAttribute("x")!)).toBeGreaterThanOrEqual(
                10
            )

            animation.stop()
        })

        it("reads dash-cased attributes as origins", async () => {
            const circle = svg("circle")
            circle.setAttribute("stroke-width", "2")

            const [animation] = animateElement(
                circle,
                { strokeWidth: 10 },
                { duration: 10, ease: "linear" }
            )

            await nextFrame()
            await nextFrame()

            const strokeWidth = svgEffect.get(circle, "strokeWidth")!.get()
            expect(strokeWidth).toBeGreaterThanOrEqual(2)
            expect(strokeWidth).toBeLessThan(3)

            animation.stop()
        })

        it("writes CSS variables to style rather than as attributes", async () => {
            const path = svg("path")

            const [animation] = animateElement(
                path,
                { "--x": [0, 1] },
                { duration: 0.05 }
            )

            await animation.finished
            await nextFrame()

            expect(path.style.getPropertyValue("--x")).toBe("1")
            expect(path.hasAttribute("--x")).toBe(false)
        })

        it("reads CSS variable origins from style", async () => {
            const path = svg("path")
            path.style.setProperty("--x", "0")

            const [animation] = animateElement(
                path,
                { "--x": 1 },
                { duration: 10, ease: "linear" }
            )

            await nextFrame()
            await nextFrame()

            const x = svgEffect.get(path, "--x")!.get()
            expect(x).toBeGreaterThanOrEqual(0)
            expect(x).toBeLessThan(0.1)

            animation.stop()
        })
    })
})
