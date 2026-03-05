import { render } from "@testing-library/react"
import { AnimateNumber } from ".."
import { LazyMotion } from "../../LazyMotion"
import { domAnimation } from "../../../render/dom/features-animation"

describe("AnimateNumber", () => {
    it("renders the initial value", () => {
        const { container } = render(<AnimateNumber>{100}</AnimateNumber>)
        expect(container.textContent).toBe("100")
    })

    it("renders with formatting", () => {
        const { container } = render(
            <AnimateNumber
                format={{ style: "currency", currency: "USD" }}
                locales="en-US"
            >
                {1234.56}
            </AnimateNumber>
        )
        expect(container.textContent).toBe("$1,234.56")
    })

    it("renders inside LazyMotion without errors", () => {
        const { container } = render(
            <LazyMotion features={domAnimation}>
                <AnimateNumber>{42}</AnimateNumber>
            </LazyMotion>
        )
        expect(container.textContent).toBe("42")
    })

    it("applies additional HTML attributes", () => {
        const { container } = render(
            <AnimateNumber className="count" data-testid="num">
                {99}
            </AnimateNumber>
        )
        const span = container.querySelector("span")!
        expect(span.className).toBe("count")
        expect(span.getAttribute("data-testid")).toBe("num")
    })

    it("is exported from the m entry point", async () => {
        const m = await import("../../../m")
        expect(m.AnimateNumber).toBeDefined()
    })
})
