import { fireEvent } from "@testing-library/dom"
import { act, useState } from "react"
import { motion, useDragControls, DragControls, motionValue } from "../../../"
import { pointerUp, render } from "../../../jest.setup"
import { nextFrame } from "../../__tests__/utils"
import { MockDrag, drag } from "./utils"

describe("useDragControls", () => {
    afterEach(() => jest.restoreAllMocks())

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

    test("snapToCursor centres the element under the pointer on every drag start", async () => {
        const x = motionValue(0)
        const y = motionValue(0)

        /**
         * Mimic a 100x100 element laid out at (500, 0) and offset by its
         * transform, as JSDOM doesn't perform layout.
         */
        const rect = (left = 0, top = 0, size = 0) =>
            ({
                left,
                top,
                right: left + size,
                bottom: top + size,
                width: size,
                height: size,
            } as DOMRect)
        jest.spyOn(
            HTMLElement.prototype,
            "getBoundingClientRect"
        ).mockImplementation(function (this: HTMLElement) {
            return this.dataset.testid === "draggable"
                ? rect(500 + x.get(), y.get(), 100)
                : rect()
        })

        const Component = () => {
            const dragControls = useDragControls()
            return (
                <>
                    <div
                        onPointerDown={(e) =>
                            dragControls.start(e, { snapToCursor: true })
                        }
                        data-testid="drag-handle"
                    />
                    <motion.div
                        drag
                        dragControls={dragControls}
                        dragListener={false}
                        initial={{ x: 100, y: 40 }}
                        style={{ x, y }}
                        data-testid="draggable"
                    />
                </>
            )
        }

        const { getByTestId } = render(<Component />)
        await nextFrame()

        const handle = getByTestId("drag-handle")
        const snapTo = (clientX: number, clientY: number) => {
            const event = new PointerEvent("pointerdown", {
                isPrimary: true,
                bubbles: true,
            })
            Object.assign(event, {
                clientX,
                clientY,
                pageX: clientX,
                pageY: clientY,
            })
            act(() => {
                fireEvent(handle, event)
            })
            pointerUp(handle)
        }

        expect(x.get()).toBe(100)
        expect(y.get()).toBe(40)

        snapTo(50, 50)
        expect(x.get()).toBe(-500)
        expect(y.get()).toBe(0)

        // Simulate the element having been dragged elsewhere
        x.set(-350)
        y.set(50)

        snapTo(50, 50)
        expect(x.get()).toBe(-500)
        expect(y.get()).toBe(0)
    })
})
