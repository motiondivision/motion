import { PanInfo } from "motion-dom"
import { useState } from "react"
import { motion, MotionConfig } from "../../"
import {
    MockDrag,
    deferred,
    drag,
    dragFrame,
} from "../../gestures/drag/__tests__/utils"
import { pointerDown, pointerMove, pointerUp, render } from "../../jest.setup"
import { nextFrame } from "./utils"

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

    test("onPanStart fires before onPan", async () => {
        const events: string[] = []
        const onPanEnd = deferred()
        const Component = () => {
            return (
                <MockDrag>
                    <motion.div
                        onPanStart={() => events.push("start")}
                        onPan={() => events.push("pan")}
                        onPanEnd={() => {
                            events.push("end")
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
        pointer.end()
        await onPanEnd.promise

        // onPanStart should fire before the first onPan
        const startIndex = events.indexOf("start")
        const firstPanIndex = events.indexOf("pan")
        expect(startIndex).toBeGreaterThanOrEqual(0)
        expect(firstPanIndex).toBeGreaterThanOrEqual(0)
        expect(startIndex).toBeLessThan(firstPanIndex)
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

    test("velocity includes a pointermove that arrives in the same frame as pointerup", async () => {
        let now = 0
        const performanceNow = jest
            .spyOn(performance, "now")
            .mockImplementation(() => now)
        const pos = { x: 0, y: 0 }
        const onPanEnd = deferred<PanInfo>()
        const Component = () => (
            <MotionConfig transformPagePoint={() => pos}>
                <motion.div onPanEnd={(_, info) => onPanEnd.resolve(info)} />
            </MotionConfig>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        try {
            await nextFrame()
            pointerDown(container.firstChild as Element)

            now = 1000
            pos.x = 10
            pointerMove(document.body)
            await nextFrame()

            now = 1050
            pos.x = 60
            pointerMove(document.body)
            pointerUp(container.firstChild as Element)

            const { offset, velocity } = await onPanEnd.promise
            expect(offset.x).toBe(60)
            // 50px between the last two moves, 50ms apart
            expect(velocity.x).toBe(1000)
        } finally {
            performanceNow.mockRestore()
        }
    })
})
