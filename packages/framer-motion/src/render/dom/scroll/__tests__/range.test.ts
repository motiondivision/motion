import { frame } from "motion-dom"
import { animate } from "../../../../animation/animate"
import { scroll } from "../"

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
})
