import * as React from "react"
import { useRef } from "react"
import { motion } from "../../.."
import { render } from "../../../jest.setup"

describe("useMotionRef", () => {
    it("should call external ref callback with element on mount", () => {
        const refCallback = jest.fn()

        const Component = () => {
            return <motion.div ref={refCallback} />
        }

        render(<Component />)

        expect(refCallback).toHaveBeenCalledTimes(1)
        expect(refCallback).toHaveBeenCalledWith(expect.any(HTMLElement))
    })

    it("should call external ref callback with null on unmount (React 18 behavior)", () => {
        const refCallback = jest.fn()

        const Component = () => {
            return <motion.div ref={refCallback} />
        }

        const { unmount } = render(<Component />)

        // Clear previous calls
        refCallback.mockClear()

        unmount()

        expect(refCallback).toHaveBeenCalledTimes(1)
        expect(refCallback).toHaveBeenCalledWith(null)
    })

    it("should support React 19 cleanup function pattern (forward compatibility)", () => {
        // This test verifies that when a ref callback returns a cleanup function,
        // our code properly stores it and calls it on unmount instead of calling ref(null).
        // This works in both React 18 and React 19 without warnings.
        const cleanup = jest.fn()
        const refCallback = jest.fn(() => cleanup)

        const Component = () => {
            return <motion.div ref={refCallback} />
        }

        const { unmount } = render(<Component />)

        // Verify mount called correctly
        expect(refCallback).toHaveBeenCalledTimes(1)
        expect(refCallback).toHaveBeenCalledWith(expect.any(HTMLElement))

        // Clear previous calls to focus on unmount behavior
        refCallback.mockClear()
        cleanup.mockClear()

        unmount()

        // With our new approach: cleanup function should be called
        // and ref should NOT be called with null
        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(refCallback).not.toHaveBeenCalledWith(null)
    })

    it("should handle RefObject refs correctly", () => {
        const Component = () => {
            const ref = useRef<HTMLDivElement>(null)
            return <motion.div ref={ref} />
        }

        const { unmount } = render(<Component />)

        // Should not throw on mount or unmount
        expect(() => unmount()).not.toThrow()
    })

    it("should handle mixed ref types in motion components", () => {
        const refCallback = jest.fn()

        const Component = ({ useCallback }: { useCallback: boolean }) => {
            const refObject = useRef<HTMLDivElement>(null)
            return <motion.div ref={useCallback ? refCallback : refObject} />
        }

        const { rerender } = render(<Component useCallback={true} />)

        expect(refCallback).toHaveBeenCalledWith(expect.any(HTMLElement))

        // Should handle transition between ref types without errors
        expect(() => rerender(<Component useCallback={false} />)).not.toThrow()
    })

    it("should handle visual element cleanup correctly with React 19 pattern", () => {
        const cleanup = jest.fn()
        const refCallback = jest.fn(() => cleanup)

        const Component = () => {
            return (
                <motion.div
                    ref={refCallback}
                    // Add motion props to ensure visual element is created
                    animate={{ x: 100 }}
                />
            )
        }

        const { unmount } = render(<Component />)

        // Clear previous calls
        refCallback.mockClear()
        cleanup.mockClear()

        unmount()

        // Both external ref cleanup and visual element unmount should happen
        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(refCallback).not.toHaveBeenCalledWith(null)
    })

    it("should work with forwardRef components and React 19 cleanup pattern", () => {
        const cleanup = jest.fn()
        const refCallback = jest.fn(() => cleanup)

        const ForwardedComponent = React.forwardRef<HTMLDivElement>(
            (props, ref) => {
                return <motion.div ref={ref} {...props} />
            }
        )

        const Component = () => {
            return <ForwardedComponent ref={refCallback} />
        }

        const { unmount } = render(<Component />)

        expect(refCallback).toHaveBeenCalledWith(expect.any(HTMLElement))

        // Clear previous calls
        refCallback.mockClear()
        cleanup.mockClear()

        unmount()

        expect(cleanup).toHaveBeenCalledTimes(1)
        expect(refCallback).not.toHaveBeenCalledWith(null)
    })
})
