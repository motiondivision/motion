import { useState } from "react"
import { motion, useDragControls, DragControls } from "../../../"
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
})
