import { AnimatePresence } from ".."
import { render } from "../../../jest.setup"
import { usePresence } from "../use-presence"
import { usePresenceData } from "../use-presence-data"

describe("usePresenceCustomData", () => {
    test("returns custom data passed to AnimatePresence", () => {
        const Child = () => {
            const data = usePresenceData()
            const [isPresent] = usePresence()
            return (
                <div
                    id="test-div"
                    style={{ opacity: isPresent ? data / 2 : data }}
                />
            )
        }

        const Parent = ({ isVisible }: { isVisible: boolean }) => (
            <AnimatePresence custom={0.5}>
                {isVisible && <Child />}
            </AnimatePresence>
        )

        const { container, rerender } = render(<Parent isVisible={true} />)
        expect(container.querySelector("#test-div")).toHaveStyle({
            opacity: 0.25,
        })

        rerender(<Parent isVisible={false} />)
        expect(container.querySelector("#test-div")).toHaveStyle({
            opacity: 0.5,
        })
    })

    test("returns undefined when not within AnimatePresence", () => {
        const Component = () => {
            const data = usePresenceData()
            return <div id="test-div" data-value={data === undefined ? 1 : 2} />
        }

        const { container } = render(<Component />)
        expect(
            container.querySelector("#test-div")?.getAttribute("data-value")
        ).toBe("1")
    })
})
