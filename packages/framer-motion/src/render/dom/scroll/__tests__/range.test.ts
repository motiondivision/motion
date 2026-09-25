import { frame } from "motion-dom"
import { scroll } from "../"
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
    await nextFrame()
    await nextFrame()
}

const transition = { duration: 1, ease: "linear" } as const

/**
 * scrollLength = scrollHeight (3000) - clientHeight (1000) = 2000, so a scroll
 * distance maps to scroll progress of `distance / 2000`.
 */
describe("scroll() rangeStart/rangeEnd", () => {
    beforeEach(async () => {
        setWindowHeight(1000)
        setDocumentHeight(3000)
        await fireScroll(0)
    })

    /**
     * 25%–50% of the scroll range is 500–1000px.
     */
    test("Maps the range onto the animation and holds either side of it", async () => {
        const box = document.createElement("div")
        document.body.appendChild(box)

        const stop = scroll(
            animate(box, { opacity: [0, 1], x: [0, 100] }, transition),
            { rangeStart: "25%", rangeEnd: "50%" }
        )

        const expectProgress = (opacity: string, transform: string) => {
            expect(box.style.opacity).toBe(opacity)
            expect(box.style.transform).toBe(transform)
        }

        // Before rangeStart: the first keyframe.
        await fireScroll(250)
        expectProgress("0", "none")

        await fireScroll(750)
        expectProgress("0.5", "translateX(50px)")

        // After rangeEnd: the last keyframe.
        await fireScroll(1500)
        expectProgress("1", "translateX(100px)")

        // Back across rangeEnd, then rangeStart.
        await fireScroll(750)
        expectProgress("0.5", "translateX(50px)")

        await fireScroll(250)
        expectProgress("0", "none")

        await fireScroll(1500)
        expectProgress("1", "translateX(100px)")

        stop()
        box.remove()
    })

    test("Accepts fractions, and a range with only one end", async () => {
        const start = document.createElement("div")
        const end = document.createElement("div")
        document.body.append(start, end)

        const stopStart = scroll(
            animate(start, { opacity: [0, 1] }, transition),
            {
                rangeStart: 0.5,
            }
        )
        const stopEnd = scroll(animate(end, { opacity: [0, 1] }, transition), {
            rangeEnd: 0.5,
        })

        await fireScroll(500)
        expect(start.style.opacity).toBe("0")
        expect(end.style.opacity).toBe("0.5")

        await fireScroll(1500)
        expect(start.style.opacity).toBe("0.5")
        expect(end.style.opacity).toBe("1")

        stopStart()
        stopEnd()
        start.remove()
        end.remove()
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

        const stop = scroll(animate(target, { opacity: [0, 1] }, transition), {
            target,
            rangeStart: "0%",
            rangeEnd: "50%",
        })

        // Before the target enters the viewport.
        await fireScroll(200)
        expect(target.style.opacity).toBe("0")

        // Cover 25% is halfway through the 0%–50% range.
        await fireScroll(875)
        expect(target.style.opacity).toBe("0.5")

        // Cover 66% is past rangeEnd.
        await fireScroll(1500)
        expect(target.style.opacity).toBe("1")

        await fireScroll(875)
        expect(target.style.opacity).toBe("0.5")

        await fireScroll(200)
        expect(target.style.opacity).toBe("0")

        stop()
        target.remove()
    })

    test("Stopping keeps the value where it is", async () => {
        const inRange = document.createElement("div")
        const held = document.createElement("div")
        document.body.append(inRange, held)

        const range = { rangeStart: "0%", rangeEnd: "50%" } as const
        const stopInRange = scroll(
            animate(inRange, { opacity: [0, 1] }, transition),
            range
        )
        const stopHeld = scroll(
            animate(held, { opacity: [0, 1] }, transition),
            range
        )

        await fireScroll(500)
        stopInRange()
        expect(inRange.style.opacity).toBe("0.5")

        await fireScroll(1500)
        stopHeld()
        expect(inRange.style.opacity).toBe("0.5")
        expect(held.style.opacity).toBe("1")

        await fireScroll(0)
        expect(inRange.style.opacity).toBe("0.5")
        expect(held.style.opacity).toBe("1")

        inRange.remove()
        held.remove()
    })
})
