import { hasStuckAncestor } from "../has-stuck-ancestor"

interface Sticky {
    position?: string
    top?: string
    bottom?: string
    rect?: { top: number; bottom: number }
    overflowX?: string
    overflowY?: string
}

const buildTree = (ancestors: Sticky[]): HTMLElement => {
    // Build [outer, ..., inner], parenting each to the previous, and return
    // the deepest child (the "instance"). Mocks getBoundingClientRect on
    // each ancestor so engagement-detection logic can be exercised in jsdom.
    const innerChild = document.createElement("div")
    let parent: HTMLElement = innerChild
    for (let i = ancestors.length - 1; i >= 0; i--) {
        const config = ancestors[i]
        const el = document.createElement("div")
        if (config.position) el.style.position = config.position
        if (config.top !== undefined) el.style.top = config.top
        if (config.bottom !== undefined) el.style.bottom = config.bottom
        if (config.overflowX) el.style.overflowX = config.overflowX
        if (config.overflowY) el.style.overflowY = config.overflowY
        if (config.rect) {
            const { top, bottom } = config.rect
            el.getBoundingClientRect = () =>
                ({
                    top,
                    bottom,
                    left: 0,
                    right: 0,
                    width: 0,
                    height: bottom - top,
                    x: 0,
                    y: top,
                    toJSON: () => ({}),
                } as DOMRect)
        }
        el.appendChild(parent)
        parent = el
    }
    document.body.appendChild(parent)
    return innerChild
}

describe("hasStuckAncestor", () => {
    const originalInnerHeight = window.innerHeight

    beforeEach(() => {
        document.body.innerHTML = ""
        Object.defineProperty(window, "innerHeight", {
            configurable: true,
            value: 800,
        })
    })

    afterAll(() => {
        Object.defineProperty(window, "innerHeight", {
            configurable: true,
            value: originalInnerHeight,
        })
    })

    it("returns false when no ancestor is sticky", () => {
        const el = buildTree([{}, {}])
        expect(hasStuckAncestor(el)).toBe(false)
    })

    it("returns true when sticky ancestor is engaged at top", () => {
        const el = buildTree([
            { position: "sticky", top: "20px", rect: { top: 20, bottom: 60 } },
        ])
        expect(hasStuckAncestor(el)).toBe(true)
    })

    it("returns true when sticky ancestor is engaged at bottom", () => {
        // window.innerHeight = 800; bottom: 100px → engaged when
        // innerHeight - rect.bottom <= 100. Set rect.bottom = 700.
        const el = buildTree([
            {
                position: "sticky",
                bottom: "100px",
                rect: { top: 660, bottom: 700 },
            },
        ])
        expect(hasStuckAncestor(el)).toBe(true)
    })

    it("returns false when sticky ancestor is NOT yet engaged", () => {
        // top: 20px but rect.top = 300 → not engaged
        const el = buildTree([
            {
                position: "sticky",
                top: "20px",
                rect: { top: 300, bottom: 340 },
            },
        ])
        expect(hasStuckAncestor(el)).toBe(false)
    })

    it("returns false when sticky has top: auto and is not engaged at bottom", () => {
        const el = buildTree([
            { position: "sticky", rect: { top: 100, bottom: 200 } },
        ])
        expect(hasStuckAncestor(el)).toBe(false)
    })

    it("returns false when an inner scroll container is between instance and the engaged sticky ancestor", () => {
        // outer sticky engaged, but a scroll container sits between it and the
        // instance — sticky pins to that container, not the viewport.
        const el = buildTree([
            { position: "sticky", top: "0px", rect: { top: 0, bottom: 100 } },
            { overflowY: "scroll" },
        ])
        expect(hasStuckAncestor(el)).toBe(false)
    })

    it("treats overflow: hidden as a scroll container", () => {
        const el = buildTree([
            { position: "sticky", top: "0px", rect: { top: 0, bottom: 100 } },
            { overflowY: "hidden" },
        ])
        expect(hasStuckAncestor(el)).toBe(false)
    })

    it("does not treat overflow: clip as a scroll container", () => {
        const el = buildTree([
            { position: "sticky", top: "0px", rect: { top: 0, bottom: 100 } },
            { overflowY: "clip" },
        ])
        expect(hasStuckAncestor(el)).toBe(true)
    })
})
