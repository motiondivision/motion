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
})
