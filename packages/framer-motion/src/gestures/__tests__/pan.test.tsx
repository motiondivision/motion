import { useState } from "react"
import { motion } from "../../"
import {
    MockDrag,
    deferred,
    drag,
    dragFrame,
} from "../../gestures/drag/__tests__/utils"
import { render } from "../../jest.setup"

describe("pan", () => {
    test("pan handlers aren't frozen at pan session start", async () => {
        let count = 0
        const onPanEnd = deferred()
        const Component = () => {
            const [increment, setIncrement] = useState(0)
            return (
                <MockDrag>
                    <motion.div
                        onPanStart={() => {
                            count += increment
                            setIncrement(2)
                        }}
                        onPan={() => (count += increment)}
                        onPanEnd={() => {
                            count += increment
                            onPanEnd.resolve()
                        }}
                    />
                </MockDrag>
            )
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)
        await dragFrame.postRender()
        await pointer.to(50, 50)
        await dragFrame.postRender()
        pointer.end()
        await onPanEnd.promise

        expect(count).toBeGreaterThan(0)
    })

    test("onPanEnd doesn't fire unless onPanStart has", async () => {
        const onPanStart = jest.fn()
        const onPanEnd = jest.fn()
        const Component = () => {
            return (
                <MockDrag>
                    <motion.div onPanStart={onPanStart} onPanEnd={onPanEnd} />
                </MockDrag>
            )
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await dragFrame.postRender()
        pointer.end()
        expect(onPanStart).not.toBeCalled()
        expect(onPanEnd).not.toBeCalled()
    })
})
