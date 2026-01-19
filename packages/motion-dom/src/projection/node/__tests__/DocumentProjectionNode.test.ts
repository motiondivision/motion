import { DocumentProjectionNode } from "../DocumentProjectionNode"

describe("DocumentProjectionNode", () => {
    describe("measureScroll", () => {
        const originalBody = document.body

        afterEach(() => {
            // Restore original body after each test
            Object.defineProperty(document, "body", {
                value: originalBody,
                writable: true,
                configurable: true,
            })
        })

        test("returns scroll position from documentElement", () => {
            // Mock scrollLeft and scrollTop on documentElement
            Object.defineProperty(document.documentElement, "scrollLeft", {
                value: 100,
                configurable: true,
            })
            Object.defineProperty(document.documentElement, "scrollTop", {
                value: 200,
                configurable: true,
            })

            const node = DocumentProjectionNode.create(window)
            const scroll = node.measureScroll()

            expect(scroll).toEqual({ x: 100, y: 200 })
        })

        test("does not throw when document.body is null", () => {
            // Set documentElement scroll to 0 to force body fallback
            Object.defineProperty(document.documentElement, "scrollLeft", {
                value: 0,
                configurable: true,
            })
            Object.defineProperty(document.documentElement, "scrollTop", {
                value: 0,
                configurable: true,
            })

            // Mock document.body as null (edge case during rapid DOM manipulation)
            Object.defineProperty(document, "body", {
                value: null,
                writable: true,
                configurable: true,
            })

            const node = DocumentProjectionNode.create(window)

            // This should not throw even when document.body is null
            expect(() => node.measureScroll()).not.toThrow()
            expect(node.measureScroll()).toEqual({ x: 0, y: 0 })
        })

        test("falls back to body scroll when documentElement scroll is 0", () => {
            Object.defineProperty(document.documentElement, "scrollLeft", {
                value: 0,
                configurable: true,
            })
            Object.defineProperty(document.documentElement, "scrollTop", {
                value: 0,
                configurable: true,
            })
            Object.defineProperty(document.body, "scrollLeft", {
                value: 50,
                configurable: true,
            })
            Object.defineProperty(document.body, "scrollTop", {
                value: 75,
                configurable: true,
            })

            const node = DocumentProjectionNode.create(window)
            const scroll = node.measureScroll()

            expect(scroll).toEqual({ x: 50, y: 75 })
        })
    })
})
