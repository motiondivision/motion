import { useState } from "react"
import {
    BoundingBox,
    motion,
    motionValue,
    MotionValue,
    useWillChange,
} from "../../../"
import { pointerDown, render } from "../../../jest.setup"
import { WillChangeMotionValue } from "../../../value/use-will-change/WillChangeMotionValue"
import { nextFrame } from "../../__tests__/utils"
import { deferred, drag, dragFrame, MockDrag, Point, sleep } from "./utils"

describe("drag", () => {
    test("onDragStart fires", async () => {
        const onDragStart = jest.fn()
        const Component = () => (
            <MockDrag>
                <motion.div drag onDragStart={onDragStart} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)

        pointer.end()

        await nextFrame()

        expect(onDragStart).toBeCalledTimes(1)
    })
})

describe("dragging", () => {
    test("willChange is applied correctly", async () => {
        const willChange = new WillChangeMotionValue("auto")
        const Component = () => (
            <MockDrag>
                <motion.div
                    data-testid="draggable"
                    drag
                    dragTransition={{
                        bounceStiffness: 100000,
                        bounceDamping: 100000,
                    }}
                    style={{ willChange }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)

        await nextFrame()

        expect(expect(willChange.get()).toBe("transform"))

        pointer.end()
    })

    test("willChange is applied correctly when other values are animating", async () => {
        const Component = () => {
            const willChange = useWillChange()
            return (
                <MockDrag>
                    <motion.div
                        data-testid="draggable"
                        drag="y"
                        dragTransition={{
                            bounceStiffness: 100000,
                            bounceDamping: 100000,
                        }}
                        initial={{ x: 0 }}
                        animate={{ x: 100 }}
                        transition={{ duration: 5 }}
                        style={{ willChange }}
                    />
                </MockDrag>
            )
        }

        const { container, getByTestId, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)

        await nextFrame()

        expect(getByTestId("draggable")).toHaveStyle("will-change: transform;")

        pointer.end()

        await nextFrame()

        expect(getByTestId("draggable")).toHaveStyle("will-change: transform;")
    })

    test("dragStart doesn't fire if dragListener === false", async () => {
        const onDragStart = jest.fn()
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    dragListener={false}
                    onDragStart={onDragStart}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)

        pointer.end()

        await nextFrame()

        expect(onDragStart).toBeCalledTimes(0)
    })

    test("dragEnd fires", async () => {
        const onDragEnd = jest.fn()
        const Component = () => (
            <MockDrag>
                <motion.div drag onDragEnd={onDragEnd} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)
        pointer.end()

        await nextFrame()

        expect(onDragEnd).toBeCalledTimes(1)
    })

    test("dragEnd doesn't fire if dragging never initiated", async () => {
        const onDragEnd = jest.fn()
        const Component = () => (
            <MockDrag>
                <motion.div drag="x" dragDirectionLock onDragEnd={onDragEnd} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(0, 0)

        pointer.end()

        await nextFrame()

        expect(onDragEnd).not.toBeCalled()
    })

    test("dragEnd does fire even if the MotionValues were physically reset", async () => {
        const x = motionValue(0)
        const onDragStart = jest.fn()
        const onDragEnd = jest.fn()
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag="x"
                    dragDirectionLock
                    onDrag={() => x.set(0)}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    style={{ x }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(10, 0)

        pointer.end()

        await nextFrame()

        expect(onDragStart).toBeCalledTimes(1)
        expect(onDragEnd).toBeCalledTimes(1)
    })

    test("drag handlers aren't frozen at drag session start", async () => {
        let count = 0
        const onDragEnd = deferred()
        const Component = () => {
            const [increment, setIncrement] = useState(1)

            return (
                <MockDrag>
                    <motion.div
                        drag
                        onDragStart={() => {
                            count += increment
                            setIncrement(2)
                        }}
                        onDrag={() => {
                            count += increment
                        }}
                        onDragEnd={() => {
                            count += increment + 1
                            onDragEnd.resolve()
                        }}
                    />
                </MockDrag>
            )
        }

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100) // + 1 + 2 = 3
        // Move fires twice + 2 = 5, if this changes in the future it's probably just
        // a change in frame scheduling.
        await dragFrame.postRender() // + 2 = 7
        await pointer.to(50, 50) // + 2 = 9
        await dragFrame.postRender() // + 2 = 11
        pointer.end() // + 3 = 14
        await onDragEnd.promise

        expect(count).toBeGreaterThanOrEqual(11)
    })

    test("dragEnd returns transformed pointer", async () => {
        const onDragEnd = deferred<Point>()
        const p: Point = { x: 0, y: 0 }

        const Component = () => (
            <MockDrag>
                <motion.div
                    data-testid="draggable"
                    drag
                    onDrag={(_e, { point }) => {
                        p.x = point.x
                        p.y = point.y
                    }}
                    onDragEnd={(_e, { point }) => {
                        onDragEnd.resolve(point)
                    }}
                    style={{ x: 100, y: 100 }}
                />
            </MockDrag>
        )

        const { getByTestId, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(getByTestId("draggable")).to(50, 50)
        pointer.end()

        await expect(onDragEnd.promise).resolves.toEqual(p)
    })

    test("panSessionStart fires", async () => {
        const onDragStart = jest.fn()
        const Component = () => (
            <MockDrag>
                <motion.div drag onPanSessionStart={onDragStart} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 100)
        pointer.end()

        await nextFrame()

        expect(onDragStart).toBeCalledTimes(1)
    })

    test("dragTransitionEnd fires", async () => {
        const onDragTransitionEnd = deferred<boolean>()
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    onDragTransitionEnd={() =>
                        onDragTransitionEnd.resolve(true)
                    }
                    dragConstraints={{
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                    }}
                    dragTransition={{
                        bounceStiffness: 100000,
                        bounceDamping: 100000,
                    }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()

        expect(onDragTransitionEnd.promise).resolves.toBe(true)
    })

    test("drag momentum is applied", async () => {
        const x = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div drag="x" style={{ x }} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()

        const endValue = await new Promise<number>((resolve) => {
            setTimeout(() => {
                resolve(x.get())
            }, 40)
        })

        return expect(endValue).toBeGreaterThan(50)
    })

    test.skip("outputs to external values if provided", async () => {
        const externalX = motionValue(0)
        const externalY = motionValue(0)
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    _dragX={externalX}
                    _dragY={externalY}
                    style={{ x, y }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
            externalX: externalX.get(),
            externalY: externalY.get(),
        }).toEqual({
            x: 0,
            y: 0,
            externalX: 50,
            externalY: 50,
        })
    })

    test.skip("drag momentum is applied to external values", async () => {
        const x = motionValue(0)
        const dragX = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div drag="x" _dragX={dragX} style={{ x }} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(50, 50)
        pointer.end()

        const checkPointer = new Promise<void>((resolve) => {
            setTimeout(() => {
                expect(dragX.get()).toBeGreaterThan(50)
                expect(x.get()).toBe(0)
                resolve()
            }, 40)
        })

        return checkPointer
    })

    test("limit to initial direction: x", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div drag dragDirectionLock style={{ x, y }} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(100, 0)
        await pointer.to(50, 4)
        await pointer.to(200, 10)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 200,
            y: 0,
        })
    })

    test("limit to initial direction: y", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div drag="y" dragDirectionLock style={{ x, y }} />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(0, 100)
        await pointer.to(4, 50)
        await pointer.to(10, 200)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 0,
            y: 200,
        })
    })

    test("block drag propagation", async () => {
        const childX = motionValue(0)
        const parentX = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div drag="x" style={{ x: parentX }}>
                    <motion.div
                        data-testid="child"
                        drag
                        style={{ x: childX }}
                    />
                </motion.div>
            </MockDrag>
        )

        const { getByTestId, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(getByTestId("child")).to(10, 0)
        await pointer.to(20, 0)
        pointer.end()

        expect({
            parentX: parentX.get(),
            childX: childX.get(),
        }).toEqual({
            parentX: 0,
            childX: 20,
        })
    })

    test("block drag propagation release velocity", async () => {
        const childX = motionValue(0)
        const parentX = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div drag="x" style={{ x: parentX }}>
                    <motion.div
                        data-testid="child"
                        drag
                        style={{ x: childX }}
                    />
                </motion.div>
            </MockDrag>
        )

        const { getByTestId, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(getByTestId("child")).to(10, 0)
        await pointer.to(20, 0)
        pointer.end()

        expect(parentX.get()).toEqual(0)
    })

    test("block drag propagation even after parent has been dragged", async () => {
        const childX = motionValue(0)
        const parentX = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    data-testid="parent"
                    drag="x"
                    style={{ x: parentX }}
                >
                    <motion.div
                        data-testid="child"
                        drag
                        style={{ x: childX }}
                    />
                </motion.div>
            </MockDrag>
        )

        const { getByTestId, rerender } = render(<Component />)
        rerender(<Component />)

        let pointer = await drag(getByTestId("parent")).to(10, 0)
        await pointer.to(20, 0)
        pointer.end()

        pointer = await drag(getByTestId("child")).to(10, 0)
        await pointer.to(20, 0)
        pointer.end()

        expect({
            parentX: parentX.get(),
            childX: childX.get(),
        }).toEqual({
            parentX: 20,
            childX: 20,
        })
    })

    test("whileDrag applies animation state", async () => {
        const opacity = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    whileDrag={{ opacity: 0.5 }}
                    transition={{ type: false }}
                    style={{ opacity }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(0, 100)
        await pointer.to(4, 50)
        expect(opacity.get()).toBe(0.5)
        await pointer.to(10, 200)
        pointer.end()

        await nextFrame()
        expect(opacity.get()).toBe(0)
    })

    test("enable drag propagation", async () => {
        const childX = motionValue(0)
        const parentX = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div drag="x" style={{ x: parentX }}>
                    <motion.div
                        data-testid="child"
                        drag="x"
                        dragPropagation
                        style={{ x: childX }}
                    />
                </motion.div>
            </MockDrag>
        )

        const { getByTestId, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(getByTestId("child")).to(10, 0)
        await pointer.to(20, 0)
        pointer.end()

        expect({
            parentX: parentX.get(),
            childX: childX.get(),
        }).toEqual({
            parentX: 20,
            childX: 20,
        })
    })

    test("allow drag propagation on opposing axis", async () => {
        const parentX = motionValue(0)
        const parentY = motionValue(0)
        const childX = motionValue(0)
        const childY = motionValue(0)

        const Component = () => (
            <MockDrag>
                <motion.div drag="x" style={{ x: parentX, y: parentY }}>
                    <motion.div
                        data-testid="child"
                        drag="y"
                        style={{ x: childX, y: childY }}
                    />
                </motion.div>
            </MockDrag>
        )

        const { getByTestId, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(getByTestId("child")).to(10, 10)

        await pointer.to(20, 20)
        pointer.end()

        expect({
            parentX: parentX.get(),
            parentY: parentY.get(),
            childX: childX.get(),
            childY: childY.get(),
        }).toEqual({
            parentX: 20,
            parentY: 0,
            childX: 0,
            childY: 20,
        })
    })

    test("impose left drag constraint", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    dragConstraints={{ left: -100 }}
                    dragElastic={false}
                    style={{ x, y }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(-200, 50)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: -100,
            y: 50,
        })
    })

    test("impose right drag constraint", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    dragConstraints={{ right: 300 }}
                    dragElastic={false}
                    style={{ x, y }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(500, 50)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 300,
            y: 50,
        })
    })

    test("impose top drag constraint", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    dragConstraints={{ top: -100 }}
                    dragElastic={false}
                    style={{ x, y }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(500, -500)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 500,
            y: -100,
        })
    })

    test("impose bottom drag constraint", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    drag
                    dragConstraints={{ bottom: 100 }}
                    dragElastic={false}
                    style={{ x, y }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(500, 500)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 500,
            y: 100,
        })
    })

    test("drag constraints can be updated", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = ({
            constraints,
        }: {
            constraints: Partial<BoundingBox>
        }) => (
            <MockDrag>
                <motion.div
                    drag
                    dragConstraints={constraints}
                    dragElastic={false}
                    style={{ x, y }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(
            <Component constraints={{ top: -100, bottom: 0 }} />
        )
        rerender(<Component constraints={{ top: -100, bottom: 0 }} />)
        rerender(<Component constraints={{ top: -50, bottom: 0 }} />)
        rerender(<Component constraints={{ top: -50, bottom: 0 }} />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(500, -500)
        pointer.end()

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 500,
            y: -50,
        })
    })

    // TODO
    test.skip("updates position when updating drag constraints", async () => {
        const x = motionValue(100)
        const y = motionValue(100)
        const Component = ({
            constraints,
        }: {
            constraints: Partial<BoundingBox>
        }) => (
            <MockDrag>
                <motion.div
                    drag
                    dragConstraints={constraints}
                    dragElastic={false}
                    style={{ x, y }}
                />
            </MockDrag>
        )

        const { rerender } = render(
            <Component constraints={{ right: 42, bottom: 53 }} />
        )

        // Should have updated the x and y
        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 42,
            y: 53,
        })

        // Should not updated when broadening the constraints
        rerender(
            <Component
                constraints={{ left: 10, top: 14, right: 100, bottom: 100 }}
            />
        )

        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 42,
            y: 53,
        })

        // Should update when updating the contstraints again
        render(<Component constraints={{ left: 60, top: 70 }} />)

        // Should have updated the x and y
        expect({
            x: x.get(),
            y: y.get(),
        }).toEqual({
            x: 60,
            y: 70,
        })
    })

    test("applies drag transition", async () => {
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div
                    style={{ x, y }}
                    drag="x"
                    dragConstraints={{ left: -500, right: 500 }}
                    dragElastic
                    dragMomentum={false}
                    dragTransition={{
                        bounceStiffness: 300000,
                        bounceDamping: 1000000,
                    }}
                />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(-500, 0)
        pointer.end()
        await sleep(50)

        // if we set really strong spring and animation has ended - this has worked
        expect(x.get()).toBeCloseTo(-500)
    })

    test("pointer down kills momentum", async () => {
        let lastX = 0
        const x = motionValue(0)
        const y = motionValue(0)
        const Component = () => (
            <MockDrag>
                <motion.div style={{ x, y }} drag />
            </MockDrag>
        )

        const { container, rerender } = render(<Component />)
        rerender(<Component />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(100, 100)
        pointer.end()

        lastX = x.get()
        pointerDown(container.firstChild as Element)
        await sleep(20)

        expect(x.get()).toBe(lastX)
    })

    // TODO
    test.skip("accepts new motion values", async () => {
        const a = motionValue(0)
        const b = motionValue(5)
        const Component = ({ x }: { x: MotionValue<number> }) => {
            return (
                <MockDrag>
                    <motion.div drag="x" style={{ x, y: 0 }} />
                </MockDrag>
            )
        }

        const { container, rerender } = render(<Component x={a} />)
        rerender(<Component x={b} />)
        rerender(<Component x={b} />)

        const pointer = await drag(container.firstChild).to(1, 1)
        await pointer.to(100, 100)
        pointer.end()

        expect(container.firstChild).toHaveStyle(
            "transform: translateX(105px) translateY(0px)"
        )
    })
})
