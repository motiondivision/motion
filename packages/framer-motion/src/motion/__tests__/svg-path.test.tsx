import { createRef } from "react"
import { motion } from "../.."
import { render } from "../../jest.setup"

describe("SVG path", () => {
    test("accepts custom transition prop", async () => {
        const element = await new Promise((resolve) => {
            const ref = createRef<SVGRectElement>()
            const Component = () => (
                <motion.rect
                    ref={ref}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.01 }}
                    onAnimationComplete={() => resolve(ref.current)}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(element).toHaveAttribute("stroke-dashoffset", "0px")
        expect(element).toHaveAttribute("stroke-dasharray", "1px 1px")
        expect(element).toHaveAttribute("pathLength", "1")
    })

    test("preserves user-defined strokeDasharray when using pathLength", async () => {
        const element = await new Promise((resolve) => {
            const ref = createRef<SVGPathElement>()
            const Component = () => (
                <motion.path
                    ref={ref}
                    strokeDasharray="3 3"
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.01 }}
                    onAnimationComplete={() => resolve(ref.current)}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        // User's strokeDasharray should be preserved, not overwritten
        expect(element).toHaveAttribute("stroke-dasharray", "3 3")
        // pathLength attribute should NOT be set to 1 when user has custom strokeDasharray
        // because it would make the dash values relative to the normalized path length
        expect(element).not.toHaveAttribute("pathLength", "1")
    })
})
