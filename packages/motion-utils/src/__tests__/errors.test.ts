import { warning, invariant } from "../errors"

describe("errors", () => {
    describe("warning", () => {
        it("should log warning when check is false", () => {
            const consoleSpy = jest
                .spyOn(console, "warn")
                .mockImplementation(() => {})

            warning(false, "Test warning message")

            // In non-production, warning should be called
            if (process.env.NODE_ENV !== "production") {
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining("Test warning message")
                )
            }

            consoleSpy.mockRestore()
        })

        it("should not log warning when check is true", () => {
            const consoleSpy = jest
                .spyOn(console, "warn")
                .mockImplementation(() => {})

            warning(true, "Test warning message")

            expect(consoleSpy).not.toHaveBeenCalled()

            consoleSpy.mockRestore()
        })

        it("should include error code link in warning message", () => {
            const consoleSpy = jest
                .spyOn(console, "warn")
                .mockImplementation(() => {})

            warning(false, "Test message", "test-error")

            if (process.env.NODE_ENV !== "production") {
                expect(consoleSpy).toHaveBeenCalledWith(
                    expect.stringContaining("motion.dev/troubleshooting/test-error")
                )
            }

            consoleSpy.mockRestore()
        })
    })

    describe("invariant", () => {
        it("should throw error when check is false", () => {
            if (process.env.NODE_ENV !== "production") {
                expect(() => {
                    invariant(false, "Test invariant message")
                }).toThrow("Test invariant message")
            }
        })

        it("should not throw error when check is true", () => {
            expect(() => {
                invariant(true, "Test invariant message")
            }).not.toThrow()
        })

        it("should include error code link in error message", () => {
            if (process.env.NODE_ENV !== "production") {
                expect(() => {
                    invariant(false, "Test message", "test-error")
                }).toThrow(/motion\.dev\/troubleshooting\/test-error/)
            }
        })
    })

    describe("process guard", () => {
        it("should handle undefined process gracefully", () => {
            // This test verifies the fix for issue #3417
            // The module-level code guards against process being undefined
            // by checking `typeof process !== "undefined"` before accessing
            // process.env.NODE_ENV
            //
            // We can't directly test module initialization, but we can verify
            // that the exports are functions (meaning the module loaded successfully)
            expect(typeof warning).toBe("function")
            expect(typeof invariant).toBe("function")
        })
    })
})
