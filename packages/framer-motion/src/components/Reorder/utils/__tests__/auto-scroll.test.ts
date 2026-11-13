import { frameData } from "motion-dom"
import { autoScrollIfNeeded, resetAutoScrollState } from "../auto-scroll"

/**
 * JSDOM has no layout, so give a page-scrolling document a 2000px tall
 * body inside a 768px viewport (JSDOM's default innerHeight).
 */
describe("autoScrollIfNeeded", () => {
    let group: HTMLElement
    let scrollBy: jest.Mock

    beforeEach(() => {
        group = document.createElement("ul")
        document.body.appendChild(group)
        document.body.getBoundingClientRect = () =>
            ({ top: 0, left: 0, bottom: 2000, right: 1024 } as DOMRect)
        Object.defineProperty(document.body, "scrollHeight", {
            value: 2000,
            configurable: true,
        })
        scrollBy = jest.fn()
        window.scrollBy = scrollBy
        // autoScrollIfNeeded runs from onDrag, inside a frame. Default to 60fps.
        frameData.delta = 1000 / 60
    })

    afterEach(() => {
        resetAutoScrollState()
        document.body.innerHTML = ""
    })

    const lastScroll = () => scrollBy.mock.calls.at(-1)[0].top

    test("scrolls faster the closer the pointer is to the edge", () => {
        autoScrollIfNeeded(group, window.innerHeight - 25, "y", 1)
        expect(lastScroll()).toBeCloseTo(6.25)

        autoScrollIfNeeded(group, window.innerHeight - 2, "y", 1)
        expect(lastScroll()).toBeCloseTo(23.04)
    })

    test("never scrolls past maxSpeed when the pointer is beyond the end edge", () => {
        autoScrollIfNeeded(group, window.innerHeight + 100, "y", 1)
        expect(lastScroll()).toBe(25)
    })

    test("never scrolls past maxSpeed when the pointer is beyond the start edge", () => {
        Object.defineProperty(window, "scrollY", {
            value: 500,
            configurable: true,
        })
        try {
            // Page point 400 is 100px above the top of the viewport
            autoScrollIfNeeded(group, 400, "y", -1)
            expect(lastScroll()).toBe(-25)
        } finally {
            Object.defineProperty(window, "scrollY", {
                value: 0,
                configurable: true,
            })
        }
    })

    /**
     * Simulate holding the pointer 10px above the bottom edge for one second
     * at the given frame rate, returning the total distance scrolled.
     */
    const scrollForOneSecond = (fps: number) => {
        resetAutoScrollState()
        scrollBy.mockClear()
        frameData.delta = 1000 / fps
        for (let i = 0; i < fps; i++) {
            autoScrollIfNeeded(group, window.innerHeight - 10, "y", 1)
        }
        return scrollBy.mock.calls.reduce((sum, [{ top }]) => sum + top, 0)
    }

    test("scroll speed is independent of the display's refresh rate", () => {
        const at60 = scrollForOneSecond(60)
        expect(at60).toBeCloseTo(960)
        expect(scrollForOneSecond(120)).toBeCloseTo(at60)
        expect(scrollForOneSecond(30)).toBeCloseTo(at60)
        expect(scrollForOneSecond(240)).toBeCloseTo(at60)
    })

    test("an extra mid-frame update doesn't scroll the frame's distance twice", () => {
        // A synchronous projection flush runs onDrag again a few ms into the
        // frame, and the following frame's delta is the remainder.
        frameData.delta = 4
        autoScrollIfNeeded(group, window.innerHeight + 100, "y", 1)
        frameData.delta = 1000 / 60 - 4
        autoScrollIfNeeded(group, window.innerHeight + 100, "y", 1)

        const total = scrollBy.mock.calls.reduce(
            (sum, [{ top }]) => sum + top,
            0
        )
        expect(total).toBeCloseTo(25)
    })
})

describe("autoScrollIfNeeded in nested scroll containers", () => {
    afterEach(() => {
        resetAutoScrollState()
        document.body.innerHTML = ""
    })

    /**
     * A container that scrolls on `scrolls`, or neither, with a 300x300 box
     * at the top left of the viewport. Its scrollLeft/Top are recorded.
     */
    function container(scrolls?: "x" | "y") {
        const element = document.createElement("div")
        // JSDOM doesn't expand the overflow shorthand
        element.style.overflowX = "auto"
        element.style.overflowY = "auto"
        element.getBoundingClientRect = () =>
            ({ top: 0, left: 0, bottom: 300, right: 300 } as DOMRect)
        for (const [size, axis] of [
            ["Width", "x"],
            ["Height", "y"],
        ]) {
            Object.defineProperty(element, `client${size}`, { value: 300 })
            Object.defineProperty(element, `scroll${size}`, {
                value: scrolls === axis ? 600 : 300,
            })
        }
        const scroll = { left: 0, top: 0 }
        Object.defineProperty(element, "scrollLeft", {
            get: () => scroll.left,
            set: (value) => (scroll.left = value),
        })
        Object.defineProperty(element, "scrollTop", {
            get: () => scroll.top,
            set: (value) => (scroll.top = value),
        })
        return element
    }

    /**
     * A board that scrolls horizontally, around a column that scrolls
     * vertically. A browser computes the column's overflow-x as auto too.
     */
    function board() {
        const outer = container("x")
        const column = container("y")
        const group = document.createElement("ul")
        outer.appendChild(column)
        column.appendChild(group)
        document.body.appendChild(outer)
        frameData.delta = 1000 / 60
        return { outer, column, group }
    }

    test("scrolls the nearest ancestor that can scroll on the axis", () => {
        const { outer, column, group } = board()

        autoScrollIfNeeded(group, 290, "x", 1)
        expect(outer.scrollLeft).toBeGreaterThan(0)
        expect(column.scrollLeft).toBe(0)

        autoScrollIfNeeded(group, 290, "y", 1)
        expect(column.scrollTop).toBeGreaterThan(0)
        expect(outer.scrollTop).toBe(0)
    })

    test("forgets every container it scrolled once the drag ends", () => {
        const { outer, column, group } = board()
        const next = container("y")
        const nextGroup = document.createElement("ul")
        next.appendChild(nextGroup)
        outer.appendChild(next)

        // Scroll a column, then carry on in the next one
        autoScrollIfNeeded(group, 290, "y", 1)
        autoScrollIfNeeded(nextGroup, 100, "y", 1)
        resetAutoScrollState()

        // The next drag starts by its end, moving away from it
        const scrolled = column.scrollTop
        autoScrollIfNeeded(group, 290, "y", -1)
        expect(column.scrollTop).toBe(scrolled)
    })
})

describe("autoScrollIfNeeded on both axes of one container", () => {
    afterEach(() => {
        resetAutoScrollState()
        document.body.innerHTML = ""
    })

    /**
     * A Reorder.Board scrolls on x then y each frame. Here both find the
     * same 300x300 container, which scrolls on both.
     */
    function setup() {
        const element = document.createElement("div")
        element.style.overflowX = "auto"
        element.style.overflowY = "auto"
        element.getBoundingClientRect = () =>
            ({ top: 0, left: 0, bottom: 300, right: 300 } as DOMRect)
        const size = { scrollHeight: 600 }
        const scroll = { left: 0, top: 0 }
        Object.defineProperties(element, {
            clientWidth: { value: 300 },
            clientHeight: { value: 300 },
            scrollWidth: { value: 600 },
            scrollHeight: { get: () => size.scrollHeight },
            scrollLeft: {
                get: () => scroll.left,
                set: (value) => (scroll.left = value),
            },
            scrollTop: {
                get: () => scroll.top,
                set: (value) => (scroll.top = value),
            },
        })
        const group = document.createElement("ul")
        element.appendChild(group)
        document.body.appendChild(element)
        frameData.delta = 1000 / 60

        const onDrag = (y: number, velocityY: number) => {
            autoScrollIfNeeded(group, 150, "x", 0)
            autoScrollIfNeeded(group, y, "y", velocityY)
        }
        return { element, size, onDrag }
    }

    test("keeps scrolling while the pointer is held at an edge", () => {
        const { element, onDrag } = setup()
        onDrag(290, 1)
        const scrolled = element.scrollTop
        expect(scrolled).toBeGreaterThan(0)

        onDrag(290, 0)
        expect(element.scrollTop).toBeGreaterThan(scrolled)
    })

    test("stops at the scroll limit from when it started scrolling", () => {
        const { element, size, onDrag } = setup()
        for (let i = 0; i < 100; i++) {
            onDrag(299, 1)
            // The dragged item, moved on by the scroll, grows the content
            size.scrollHeight = 600 + element.scrollTop
        }
        expect(element.scrollTop).toBeLessThan(300 + 25)
    })
})
