import { isNodeOrChild } from "motion-dom"
import { render } from "../../jest.setup"

describe("isNodeOrChild", () => {
    test("tap event listeners fire", () => {
        const Component = () => (
            <div>
                <div data-testid="a">
                    <div data-testid="b" />
                </div>
                <div data-testid="c">
                    <div data-testid="d" />
                </div>
            </div>
        )

        const { container, getByTestId } = render(<Component />)

        expect(
            isNodeOrChild(
                container.firstChild as Element,
                container.firstChild as Element
            )
        ).toBe(true)
        expect(isNodeOrChild(getByTestId("a"), getByTestId("b"))).toBe(true)
        expect(isNodeOrChild(getByTestId("b"), getByTestId("a"))).toBe(false)
        expect(isNodeOrChild(getByTestId("c"), getByTestId("a"))).toBe(false)
    })
})
