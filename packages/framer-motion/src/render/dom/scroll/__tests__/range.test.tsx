import { frame } from "motion-dom"
import { createRef } from "react"
import { scroll } from "../"
import { motion } from "../../../.."
import { render } from "../../../../jest.setup"
import { animate } from "../../../../animation/animate"

// Mock scrollingElement for testing
Object.defineProperty(document, "scrollingElement", {
    value: document.documentElement,
    writable: false,
    configurable: true,
})

const measurements = new Map<Element, Record<string, number>>()

const createMockMeasurement = (element: Element, name: string) => {
    const elementMeasurements = measurements.get(element) || {}
    measurements.set(element, elementMeasurements)

    if (!element.hasOwnProperty(name)) {
        Object.defineProperty(element, name, {
            get: () => elementMeasurements[name] ?? 0,
            set: () => {},
        })
    }

    return (value: number) => {
        elementMeasurements[name] = value
    }
}

const setWindowHeight = createMockMeasurement(
    document.scrollingElement!,
    "clientHeight"
)
const setDocumentHeight = createMockMeasurement(
    document.scrollingElement!,
    "scrollHeight"
)
const setScrollTop = createMockMeasurement(
    document.scrollingElement!,
    "scrollTop"
)

async function nextFrame() {
    return new Promise<void>((resolve) => {
        window.dispatchEvent(new window.Event("scroll"))
        frame.postRender(() => resolve())
    })
}

async function fireScroll(distance: number) {
    setScrollTop(distance)
    window.dispatchEvent(new window.Event("scroll"))
    return nextFrame()
}

/**
 * scrollLength = scrollHeight (3000) - clientHeight (1000) = 2000, so a scroll
 * distance maps to raw scroll progress of `distance / 2000`.
 */
describe("scroll() rangeStart/rangeEnd (#3001)", () => {
    beforeEach(async () => {
        setWindowHeight(1000)
        setDocumentHeight(3000)
        await fireScroll(0)
    })

    test("JS animation maps to and deactivates outside the range", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        const animation = animate(
            box,
            { opacity: [0, 1] },
            { duration: 1, ease: "linear" }
        )

        // Let keyframes resolve and the timeline attach.
        await nextFrame()
        await nextFrame()

        const stop = scroll(animation, { rangeStart: "0%", rangeEnd: "50%" })

        // 25% scroll is halfway through the 0%–50% range → opacity 0.5.
        await fireScroll(500)
        await nextFrame()
        expect(parseFloat(box.style.opacity)).toBeCloseTo(0.5, 2)

        // Past rangeEnd (50%) the animation deactivates: its inline style is
        // removed so the CSS cascade (e.g. :hover) can take over.
        await fireScroll(1500)
        await nextFrame()
        expect(box.style.opacity).toBe("")

        // Scrolling back into the range reactivates the animation.
        await fireScroll(500)
        await nextFrame()
        expect(parseFloat(box.style.opacity)).toBeCloseTo(0.5, 2)

        stop()
        box.remove()
    })

    test("JS animation is inactive before a non-zero rangeStart", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        const animation = animate(
            box,
            { opacity: [0, 1] },
            { duration: 1, ease: "linear" }
        )

        await nextFrame()
        await nextFrame()

        const stop = scroll(animation, { rangeStart: "25%", rangeEnd: "75%" })

        // 10% scroll is before rangeStart (25%) → inactive.
        await fireScroll(200)
        await nextFrame()
        expect(box.style.opacity).toBe("")

        // 50% scroll is halfway through the 25%–75% range → opacity 0.5.
        await fireScroll(1000)
        await nextFrame()
        expect(parseFloat(box.style.opacity)).toBeCloseTo(0.5, 2)

        // 90% scroll is past rangeEnd (75%) → inactive again.
        await fireScroll(1800)
        await nextFrame()
        expect(box.style.opacity).toBe("")

        stop()
        box.remove()
    })

    test("Attaching synchronously starts inactive when outside the range", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        const stop = scroll(
            animate(box, { opacity: [0, 1] }, { duration: 1, ease: "linear" }),
            { rangeStart: 0.25, rangeEnd: 0.75 }
        )

        await nextFrame()
        await nextFrame()
        expect(box.style.opacity).toBe("")

        await fireScroll(1000)
        await nextFrame()
        expect(parseFloat(box.style.opacity)).toBeCloseTo(0.5, 2)

        stop()
        box.remove()
    })

    test("Stopping while inactive doesn't write the value back", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        const stop = scroll(
            animate(box, { opacity: [0, 1] }, { duration: 1, ease: "linear" }),
            { rangeStart: 0.5 }
        )

        await nextFrame()
        await nextFrame()
        expect(box.style.opacity).toBe("")

        stop()
        await nextFrame()
        expect(box.style.opacity).toBe("")

        box.remove()
    })

    test("Transform values deactivate and reactivate", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        const stop = scroll(
            animate(box, { x: [0, 100] }, { duration: 1, ease: "linear" }),
            { rangeStart: "0%", rangeEnd: "50%" }
        )

        await fireScroll(500)
        await nextFrame()
        expect(box.style.transform).toBe("translateX(50px)")

        await fireScroll(1500)
        await nextFrame()
        expect(box.style.transform).toBe("")

        await fireScroll(500)
        await nextFrame()
        expect(box.style.transform).toBe("translateX(50px)")

        stop()
        box.remove()
    })

    test("Transform origin values deactivate", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        const stop = scroll(
            animate(box, { originX: [0, 1] }, { duration: 1, ease: "linear" }),
            { rangeStart: "0%", rangeEnd: "50%" }
        )

        await fireScroll(500)
        await nextFrame()
        expect(box.style.transformOrigin).toBe("50% 50% 0")

        await fireScroll(1500)
        await nextFrame()
        expect(box.style.transformOrigin).toBe("")

        stop()
        box.remove()
    })

    /**
     * With a target, native ViewTimeline resolves a plain percentage against
     * the timeline's cover range, so the JS path must too.
     *
     * Target top = 1500, height = 500, viewport = 1000:
     * cover 0% = scroll 500, cover 100% = scroll 2000.
     * rangeStart "0%" → 500, rangeEnd "50%" → 1250.
     */
    test("With a target, the range is relative to the target's cover range", async () => {
        const target = document.createElement("div")
        document.documentElement.appendChild(target)
        createMockMeasurement(target, "clientHeight")(500)
        createMockMeasurement(target, "offsetTop")(1500)

        const stop = scroll(
            animate(
                target,
                { opacity: [0, 1] },
                { duration: 1, ease: "linear" }
            ),
            { target, rangeStart: "0%", rangeEnd: "50%" }
        )

        // Before the target enters the viewport → inactive.
        await fireScroll(200)
        await nextFrame()
        expect(target.style.opacity).toBe("")

        // Cover 25% is halfway through the 0%–50% range.
        await fireScroll(875)
        await nextFrame()
        expect(parseFloat(target.style.opacity)).toBeCloseTo(0.5, 2)

        // Cover 66% is past rangeEnd.
        await fireScroll(1500)
        await nextFrame()
        expect(target.style.opacity).toBe("")

        stop()
        target.remove()
    })

    test("Deactivating a transform keeps the element's other transforms", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        animate(box, { rotate: 45 }, { duration: 0 })
        const stop = scroll(
            animate(box, { x: [0, 100] }, { duration: 1, ease: "linear" }),
            { rangeStart: "0%", rangeEnd: "50%" }
        )

        await fireScroll(500)
        await nextFrame()
        expect(box.style.transform).toBe("translateX(50px) rotate(45deg)")

        await fireScroll(1500)
        await nextFrame()
        expect(box.style.transform).toBe("rotate(45deg)")

        // Other transforms changing don't bring the inactive one back.
        animate(box, { scale: 2 }, { duration: 0 })
        await nextFrame()
        await nextFrame()
        expect(box.style.transform).toBe("scale(2) rotate(45deg)")

        await fireScroll(500)
        await nextFrame()
        expect(box.style.transform).toBe(
            "translateX(50px) scale(2) rotate(45deg)"
        )

        stop()
        box.remove()
    })

    test("SVG attributes deactivate", async () => {
        const svg = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "svg"
        )
        const circle = document.createElementNS(svg.namespaceURI, "circle")
        const path = document.createElementNS(svg.namespaceURI, "path")
        svg.append(circle, path)
        document.body.appendChild(svg)

        const transition = { duration: 1, ease: "linear" } as const
        const range = { rangeStart: "0%", rangeEnd: "50%" } as const
        const stopCircle = scroll(
            animate(circle, { cx: [0, 100] }, transition),
            range
        )
        const stopPath = scroll(
            animate(path, { pathLength: [0, 1] }, transition),
            range
        )

        await fireScroll(500)
        await nextFrame()
        expect(circle.getAttribute("cx")).toBe("50")
        expect(path.getAttribute("stroke-dasharray")).toBe("0.5 0.5")

        await fireScroll(1500)
        await nextFrame()
        expect(circle.getAttribute("cx")).toBe(null)
        expect(path.getAttribute("stroke-dasharray")).toBe(null)

        await fireScroll(500)
        await nextFrame()
        expect(circle.getAttribute("cx")).toBe("50")
        expect(path.getAttribute("stroke-dasharray")).toBe("0.5 0.5")

        stopCircle()
        stopPath()
        svg.remove()
    })

    test("Motion component renders don't reapply deactivated values", async () => {
        const ref = createRef<HTMLDivElement>()
        const Component = ({ color }: { color: string }) => (
            <motion.div ref={ref} style={{ backgroundColor: color }} />
        )
        const { rerender } = render(<Component color="#f00" />)
        const box = ref.current!

        const stop = scroll(
            animate(
                box,
                { opacity: [0, 1], x: [0, 100] },
                { duration: 1, ease: "linear" }
            ),
            { rangeStart: "0%", rangeEnd: "50%" }
        )

        await fireScroll(500)
        await nextFrame()
        expect(box.style.opacity).toBe("0.5")
        expect(box.style.transform).toBe("translateX(50px)")

        await fireScroll(1500)
        await nextFrame()
        expect(box.style.opacity).toBe("")
        expect(box.style.transform).toBe("")

        // Another value on the same component renders it.
        animate(box, { rotate: 45 }, { duration: 0 })
        await nextFrame()
        await nextFrame()
        expect(box.style.opacity).toBe("")
        expect(box.style.transform).toBe("rotate(45deg)")

        rerender(<Component color="#00f" />)
        await nextFrame()
        expect(box.style.opacity).toBe("")

        await fireScroll(500)
        await nextFrame()
        expect(box.style.opacity).toBe("0.5")
        expect(box.style.transform).toBe("translateX(50px) rotate(45deg)")

        stop()
    })

    test("Motion SVG component renders don't reapply deactivated attributes", async () => {
        const ref = createRef<SVGCircleElement>()
        render(
            <svg>
                <motion.circle ref={ref} />
            </svg>
        )
        const circle = ref.current!

        const stop = scroll(
            animate(circle, { cx: [0, 100] }, { duration: 1, ease: "linear" }),
            { rangeStart: "0%", rangeEnd: "50%" }
        )

        await fireScroll(500)
        await nextFrame()
        expect(circle.getAttribute("cx")).toBe("50")

        await fireScroll(1500)
        await nextFrame()
        expect(circle.getAttribute("cx")).toBe(null)

        animate(circle, { r: 10 }, { duration: 0 })
        await nextFrame()
        await nextFrame()
        expect(circle.getAttribute("r")).toBe("10")
        expect(circle.getAttribute("cx")).toBe(null)

        await fireScroll(500)
        await nextFrame()
        expect(circle.getAttribute("cx")).toBe("50")

        stop()
    })
})
