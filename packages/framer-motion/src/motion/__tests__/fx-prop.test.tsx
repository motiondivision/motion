import type { DOMKeyframesDefinition } from "motion-dom"
import { motion } from "../.."
import { render } from "../../jest.setup"

describe("fx prop", () => {
    test("renders as an attribute, which marks the element for a canvas layer", () => {
        const error = jest.spyOn(console, "error").mockImplementation(() => {})
        const { container, rerender } = render(<motion.div fx />)
        expect(container.firstElementChild!.getAttribute("fx")).toBe("")

        rerender(<motion.div fx={false} />)
        expect(container.firstElementChild!.hasAttribute("fx")).toBe(false)

        expect(error).not.toHaveBeenCalled()
        error.mockRestore()
    })

    test("shaders is an animation target, for the effects of one element", () => {
        const shaders = [{ shader: {}, values: { amount: 1 } }]
        const { container } = render(
            <motion.div fx initial={{ shaders }} whileHover={{ shaders }} />
        )
        expect(container.firstElementChild!.getAttribute("fx")).toBe("")

        // And of animate()
        const target: DOMKeyframesDefinition = { x: 100, shaders }
        expect(target.shaders).toBe(shaders)
    })
})
