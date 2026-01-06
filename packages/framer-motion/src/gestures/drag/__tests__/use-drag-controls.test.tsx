import { useState } from "react"
import { motion, useDragControls, DragControls, motionValue } from "../../../"
import { render } from "../../../jest.setup"
import { nextFrame } from "../../__tests__/utils"
import { MockDrag, drag } from "./utils"

describe("useDragControls", () => {
    test(".start triggers dragging on a different component", async () => {
        const onDragStart = jest.fn()
        const Component = () => {
            const dragControls = useDragControls()
            return (
                <MockDrag>
                    <div
                        onPointerDown={(e) => dragControls.start(e)}
                        data-testid="drag-handle"
                    />
                    <motion.div
                        drag
                        onDragStart={onDragStart}
                        dragControls={dragControls}
                        data-testid="draggable"
                    />
                </MockDrag>
            )
        }

        const { rerender, getByTestId } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(
            getByTestId("draggable"),
            getByTestId("drag-handle")
        ).to(100, 100)

        pointer.end()

        await nextFrame()

        expect(onDragStart).toBeCalledTimes(1)
    })

    test(".start triggers dragging on its parent", async () => {
        const onDragStart = jest.fn()
        const Component = () => {
            const dragControls = useDragControls()
            return (
                <MockDrag>
                    <div
                        onPointerDown={(e) => dragControls.start(e)}
                        data-testid="drag-handle"
                    >
                        <motion.div
                            drag
                            onDragStart={onDragStart}
                            dragControls={dragControls}
                            data-testid="draggable"
                        />
                    </div>
                </MockDrag>
            )
        }

        const { rerender, getByTestId } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(
            getByTestId("draggable"),
            getByTestId("drag-handle")
        ).to(100, 100)

        pointer.end()
        await nextFrame()
        expect(onDragStart).toBeCalledTimes(1)
    })

    test("dragControls can be updated", async () => {
        const onDragStart = jest.fn()
        const Component = ({
            dragControls,
        }: {
            dragControls: DragControls | undefined
        }) => {
            return (
                <MockDrag>
                    <div
                        onPointerDown={(e) => dragControls?.start(e)}
                        data-testid="drag-handle"
                    />
                    <motion.div
                        drag
                        onDragStart={onDragStart}
                        dragControls={dragControls}
                        data-testid="draggable"
                    />
                </MockDrag>
            )
        }

        const ControlledComponent = () => {
            const controls1 = useDragControls()
            const controls2 = useDragControls()
            const [useFirst, setUseFirst] = useState(true)

            return (
                <>
                    <button
                        data-testid="switch"
                        onClick={() => setUseFirst(false)}
                    />
                    <Component
                        dragControls={useFirst ? controls1 : controls2}
                    />
                </>
            )
        }

        const { rerender, getByTestId } = render(<ControlledComponent />)
        rerender(<ControlledComponent />)

        // First drag with initial controls
        let pointer = await drag(
            getByTestId("draggable"),
            getByTestId("drag-handle")
        ).to(100, 100)
        pointer.end()
        await nextFrame()
        expect(onDragStart).toBeCalledTimes(1)

        // Switch controls
        getByTestId("switch").click()
        await nextFrame()

        // Drag again with new controls
        pointer = await drag(
            getByTestId("draggable"),
            getByTestId("drag-handle")
        ).to(100, 100)
        pointer.end()
        await nextFrame()
        expect(onDragStart).toBeCalledTimes(2)
    })

    test("snapToCursor works correctly with initial coordinates", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => {
            const dragControls = useDragControls()
            return (
                <MockDrag>
                    <div
                        onPointerDown={(e) =>
                            dragControls.start(e, { snapToCursor: true })
                        }
                        data-testid="drag-handle"
                    />
                    <motion.div
                        drag
                        dragControls={dragControls}
                        initial={{ x: 100, y: 100 }}
                        style={{ x, y }}
                        data-testid="draggable"
                    />
                </MockDrag>
            )
        }

        const { rerender, getByTestId } = render(<Component />)
        rerender(<Component />)

        // Wait for initial values to be applied
        await nextFrame()

        // The element should start at x=100, y=100
        expect(x.get()).toBe(100)
        expect(y.get()).toBe(100)

        // Drag to position (50, 50) with snapToCursor
        const pointer = await drag(
            getByTestId("draggable"),
            getByTestId("drag-handle")
        ).to(50, 50)

        await nextFrame()

        // With snapToCursor, the element should snap to the cursor position
        // The x and y values should reflect the cursor position relative to the element's center
        // The key is that the values should be consistent regardless of initial position
        const xAfterFirstSnap = x.get()
        const yAfterFirstSnap = y.get()

        pointer.end()
        await nextFrame()

        // Now do a second drag to the same position to verify behavior is consistent
        const pointer2 = await drag(
            getByTestId("draggable"),
            getByTestId("drag-handle")
        ).to(50, 50)

        await nextFrame()

        // The snap behavior should be the same on the second drag
        // Before the fix, first drag was different from second drag due to
        // not accounting for the initial coordinates in the layout measurement
        expect(x.get()).toBeCloseTo(xAfterFirstSnap, 0)
        expect(y.get()).toBeCloseTo(yAfterFirstSnap, 0)

        pointer2.end()
    })
})
