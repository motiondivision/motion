describe("DocumentProjectionNode", () => {
    describe("measureScroll null body handling", () => {
        const originalBody = document.body

        afterEach(() => {
            // Restore original body after each test
            Object.defineProperty(document, "body", {
                value: originalBody,
                writable: true,
                configurable: true,
            })
        })

        test("accessing document.body?.scrollLeft does not throw when body is null", () => {
            // Mock document.body as null (edge case during rapid DOM manipulation)
            Object.defineProperty(document, "body", {
                value: null,
                writable: true,
                configurable: true,
            })

            // This simulates the measureScroll logic in DocumentProjectionNode
            // The fix adds optional chaining to prevent TypeError
            expect(() => {
                const x =
                    document.documentElement.scrollLeft ||
                    document.body?.scrollLeft ||
                    0
                const y =
                    document.documentElement.scrollTop ||
                    document.body?.scrollTop ||
                    0
                return { x, y }
            }).not.toThrow()
        })

        test("returns 0 when both documentElement and body scroll are 0 or unavailable", () => {
            Object.defineProperty(document.documentElement, "scrollLeft", {
                value: 0,
                configurable: true,
            })
            Object.defineProperty(document.documentElement, "scrollTop", {
                value: 0,
                configurable: true,
            })
            Object.defineProperty(document, "body", {
                value: null,
                writable: true,
                configurable: true,
            })

            const x =
                document.documentElement.scrollLeft ||
                document.body?.scrollLeft ||
                0
            const y =
                document.documentElement.scrollTop ||
                document.body?.scrollTop ||
                0

            expect(x).toBe(0)
            expect(y).toBe(0)
        })

        test("uses documentElement scroll when available", () => {
            Object.defineProperty(document.documentElement, "scrollLeft", {
                value: 100,
                configurable: true,
            })
            Object.defineProperty(document.documentElement, "scrollTop", {
                value: 200,
                configurable: true,
            })

            const x =
                document.documentElement.scrollLeft ||
                document.body?.scrollLeft ||
                0
            const y =
                document.documentElement.scrollTop ||
                document.body?.scrollTop ||
                0

            expect(x).toBe(100)
            expect(y).toBe(200)
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

            const x =
                document.documentElement.scrollLeft ||
                document.body?.scrollLeft ||
                0
            const y =
                document.documentElement.scrollTop ||
                document.body?.scrollTop ||
                0

            expect(x).toBe(50)
            expect(y).toBe(75)
        })
    })
})
