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
})
