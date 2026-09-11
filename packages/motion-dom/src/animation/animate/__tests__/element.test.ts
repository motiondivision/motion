import { frame } from "../../../frameloop"
import { motionValue } from "../../../value"
import { animateElement, getElementState } from "../element"

async function nextFrame() {
    return new Promise<void>((resolve) => {
        frame.postRender(() => resolve())
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
        expect(getElementState(element).getValue("opacity")!.get()).toBe(
            undefined
        )

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
    })

    it("owns the motion values so WAAPI can be used", () => {
        const element = document.createElement("div")

        animateElement(element, { opacity: 1 }, { duration: 0.05 })

        const value = getElementState(element).getValue("opacity")!
        expect(value.owner!.current).toBe(element)
        expect(value.owner!.getProps()).toEqual({})
    })

    it("skips values already at their target", async () => {
        const element = document.createElement("div")
        const opacity = motionValue(1)
        getElementState(element).addValue("opacity", opacity)

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
        const width = getElementState(element).getValue("width")!.get()
        expect(typeof width).toBe("number")
        expect(width).toBeGreaterThanOrEqual(50)
        expect(width).toBeLessThan(51)
        expect(element.style.width.endsWith("px")).toBe(true)

        animation.stop()
        jest.restoreAllMocks()
        element.remove()
    })
})
