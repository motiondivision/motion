import { createRef } from "react"
import { motion } from "../.."
import { render } from "../../jest.setup"

describe("motion.meta", () => {
    test("animates content attribute", async () => {
        const element = await new Promise<HTMLMetaElement>((resolve) => {
            const ref = createRef<HTMLMetaElement>()
            const Component = () => (
                <motion.meta
                    ref={ref}
                    name="theme-color"
                    initial={{ content: "rgba(255, 0, 0, 1)" }}
                    animate={{ content: "rgba(0, 0, 255, 1)" }}
                    transition={{ duration: 0.01 }}
                    onAnimationComplete={() => resolve(ref.current!)}
                />
            )
            const { rerender } = render(<Component />)
            rerender(<Component />)
        })

        expect(element.getAttribute("content")).toBe("rgba(0, 0, 255, 1)")
    })
})
