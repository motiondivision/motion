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

        expect(element).toHaveAttribute("stroke-dashoffset", "0")
        expect(element).toHaveAttribute("stroke-dasharray", "1 1")
        expect(element).toHaveAttribute("pathLength", "1")
    })

    test("animates d between paths with matching command structure", async () => {
        const element = await new Promise<SVGPathElement | null>((resolve) => {
            const ref = createRef<SVGPathElement>()
            const Component = ({ d }: { d: string }) => (
                <svg>
                    <motion.path
                        ref={ref}
                        initial={{ d: "M 0 0 L 100 0 L 100 100 L 0 100 Z" }}
                        animate={{ d }}
                        transition={{ duration: 0.01 }}
                        onAnimationComplete={() => resolve(ref.current)}
                    />
                </svg>
            )
            const target = "M 50 0 L 100 50 L 50 100 L 0 50 Z"
            const { rerender } = render(<Component d={target} />)
            rerender(<Component d={target} />)
        })

        expect(element).toHaveAttribute("d", "M 50 0 L 100 50 L 50 100 L 0 50 Z")
    })
})
