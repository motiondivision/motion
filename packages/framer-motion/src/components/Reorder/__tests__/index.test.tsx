import { act } from "react"
import { useContext, useLayoutEffect, useRef, useState } from "react"
import { Reorder } from ".."
import { ReorderContext } from "../../../context/ReorderContext"
import { fireEvent } from "@testing-library/react"
import { render } from "../../../jest.setup"
import { nextFrame } from "../../../gestures/__tests__/utils"
import { drag, MockDrag } from "../../../gestures/drag/__tests__/utils"

describe("Reorder", () => {
    it("Accepts union array types for values prop", () => {
        const Component = () => {
            const [items, setItems] = useState<number[] | string[]>([
                "a",
                "b",
                "c",
            ])

            return (
                <Reorder.Group values={items} onReorder={setItems} axis="y">
                    {items.map((item) => (
                        <Reorder.Item key={item} value={item}>
                            {item}
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            )
        }

        const { container } = render(<Component />)
        expect(container.querySelectorAll("li")).toHaveLength(3)
    })

    it("Correctly hydrates ref", () => {
        let groupRefPass = false
        let itemRefPass = false

        const Component = () => {
            const groupRef = useRef<HTMLElement>(null)
            const itemRef = useRef<HTMLElement>(null)

            useLayoutEffect(() => {
                if (groupRef.current !== null) {
                    groupRefPass = true
                }

                if (itemRef.current !== null) {
                    itemRefPass = true
                }
            })

            return (
                <Reorder.Group
                    as="article"
                    ref={groupRef}
                    onReorder={() => {}}
                    values={[]}
                >
                    <Reorder.Item as="main" ref={itemRef} value={0} />
                </Reorder.Group>
            )
        }

        render(<Component />)
        expect(groupRefPass).toBe(true)
        expect(itemRefPass).toBe(true)
    })

    it("Calls the cleanup a callback ref returns, rather than the ref with null", () => {
        const calls: Array<string | null> = []
        const callbackRef = (name: string) => (element: Element | null) => {
            calls.push(element ? name : null)
            return () => {
                calls.push(`${name} cleanup`)
            }
        }

        const { unmount } = render(
            <Reorder.Group
                ref={callbackRef("group")}
                onReorder={() => {}}
                values={[0]}
            >
                <Reorder.Item ref={callbackRef("item")} value={0} />
            </Reorder.Group>
        )
        unmount()

        expect([...calls].sort()).toEqual([
            "group",
            "group cleanup",
            "item",
            "item cleanup",
        ])
    })

    it("Doesn't keep its element once a callback ref's cleanup is called", () => {
        let context: any = null
        const Capture = () => {
            context = useContext(ReorderContext)
            return null
        }

        const { unmount } = render(
            <Reorder.Group ref={() => () => {}} onReorder={() => {}} values={[]}>
                <Capture />
            </Reorder.Group>
        )
        expect(context.groupRef.current).toBeInstanceOf(Element)
        unmount()

        expect(context.groupRef.current).toBeNull()
    })

    it("Preserves unmeasured items during reorder (virtualized list support)", () => {
        const onReorder = jest.fn()
        let capturedContext: any = null

        const ContextCapture = () => {
            const context = useContext(ReorderContext)
            capturedContext = context
            return null
        }

        const Component = () => (
            <Reorder.Group
                onReorder={onReorder}
                values={[1, 2, 3, 4, 5]}
                axis="y"
            >
                <ContextCapture />
            </Reorder.Group>
        )

        render(<Component />)

        // Register only a subset of items (simulating virtualization —
        // items 1 and 5 are offscreen and not rendered/measured)
        capturedContext.registerItem(2, {
            x: { min: 0, max: 100 },
            y: { min: 0, max: 50 },
        })
        capturedContext.registerItem(3, {
            x: { min: 0, max: 100 },
            y: { min: 50, max: 100 },
        })
        capturedContext.registerItem(4, {
            x: { min: 0, max: 100 },
            y: { min: 100, max: 150 },
        })

        // Drag item 2 past item 3: offset=30, velocity=1
        // Item 2 max=50, item 3 center=75, 50+30=80 > 75 triggers swap
        capturedContext.updateOrder(2, { x: 0, y: 30 }, { x: 0, y: 1 })

        // Should swap 2 and 3 in the FULL values array, not just measured items
        expect(onReorder).toHaveBeenCalledWith([1, 3, 2, 4, 5], 2)
    })

    it.each([["xy"], [undefined]])(
        "Reorders a grid across both axes with axis=%s",
        (axis) => {
            const onReorder = jest.fn()
            let capturedContext: any = null

            const ContextCapture = () => {
                capturedContext = useContext(ReorderContext)
                return null
            }

            render(
                <Reorder.Group
                    axis={axis as any}
                    onReorder={onReorder}
                    values={["a", "b", "c", "d"]}
                >
                    <ContextCapture />
                </Reorder.Group>
            )

            act(() => {
                capturedContext.registerItem("a", {
                    x: { min: 0, max: 100 },
                    y: { min: 0, max: 100 },
                })
                capturedContext.registerItem("b", {
                    x: { min: 100, max: 200 },
                    y: { min: 0, max: 100 },
                })
                capturedContext.registerItem("c", {
                    x: { min: 0, max: 100 },
                    y: { min: 100, max: 200 },
                })
                capturedContext.registerItem("d", {
                    x: { min: 100, max: 200 },
                    y: { min: 100, max: 200 },
                })
            })

            capturedContext.updateOrder("a", { x: 100, y: 100 }, { x: 1, y: 1 })

            expect(onReorder).toHaveBeenCalledWith(["b", "c", "d", "a"], "a")
        }
    )
})

describe("Reorder onReorder moved item", () => {
    let context: any = null
    const ContextCapture = () => {
        context = useContext(ReorderContext)
        return null
    }

    const box = (x: number, y: number) => ({
        x: { min: x, max: x + 100 },
        y: { min: y, max: y + 50 },
    })

    it("Passes the moved value to onReorder on a single-axis reorder", () => {
        const onReorder = jest.fn()

        render(
            <Reorder.Group
                axis="y"
                values={["a", "b", "c"]}
                onReorder={(order, moved) => {
                    // Typed as the values' element type
                    const typed: string = moved
                    onReorder(order, typed)
                }}
            >
                <ContextCapture />
            </Reorder.Group>
        )

        act(() => {
            context.registerItem("a", box(0, 0))
            context.registerItem("b", box(0, 50))
            context.registerItem("c", box(0, 100))
        })

        // Drag "c" up past "b"'s center
        context.updateOrder("c", { x: 0, y: -30 }, { x: 0, y: -1 })

        expect(onReorder).toHaveBeenCalledTimes(1)
        expect(onReorder).toHaveBeenCalledWith(["a", "c", "b"], "c")
    })

    it("Passes the moved value when moving between grid lines", () => {
        const onReorder = jest.fn()

        render(
            <Reorder.Group
                axis="xy"
                values={["a", "b", "c", "d"]}
                onReorder={onReorder}
            >
                <ContextCapture />
            </Reorder.Group>
        )

        act(() => {
            context.registerItem("a", box(0, 0))
            context.registerItem("b", box(100, 0))
            context.registerItem("c", box(0, 50))
            context.registerItem("d", box(100, 50))
        })

        context.updateOrder("a", { x: 100, y: 50 }, { x: 1, y: 1 })

        expect(onReorder).toHaveBeenCalledWith(["b", "c", "d", "a"], "a")
    })

    it("Lets the moved index be read from the new order", () => {
        const moves: Array<[from: number, to: number]> = []

        const Component = () => {
            const [items, setItems] = useState(["a", "b", "c"])

            return (
                <Reorder.Group
                    axis="y"
                    values={items}
                    onReorder={(order, moved) => {
                        moves.push([items.indexOf(moved), order.indexOf(moved)])
                        setItems(order)
                    }}
                >
                    <ContextCapture />
                </Reorder.Group>
            )
        }

        render(<Component />)

        act(() => {
            context.registerItem("a", box(0, 0))
            context.registerItem("b", box(0, 50))
            context.registerItem("c", box(0, 100))
        })

        act(() => {
            context.updateOrder("a", { x: 0, y: 30 }, { x: 0, y: 1 })
        })

        expect(moves).toEqual([[0, 1]])
    })
})

describe("Reorder click after drag", () => {
    interface Handlers {
        onReorder: jest.Mock
        onGroupClick: jest.Mock
        onItemClick: jest.Mock
        onChildClick: jest.Mock
    }

    let context: any = null
    const ContextCapture = () => {
        context = useContext(ReorderContext)
        return null
    }

    const Component = (handlers: Handlers) => {
        const [items, setItems] = useState(["a", "b"])

        return (
            <MockDrag>
                <Reorder.Group
                    values={items}
                    onReorder={(newOrder, moved) => {
                        handlers.onReorder(newOrder, moved)
                        setItems(newOrder)
                    }}
                    axis="y"
                    data-testid="group"
                    onClick={handlers.onGroupClick}
                >
                    <ContextCapture />
                    {items.map((item) => (
                        <Reorder.Item
                            key={item}
                            value={item}
                            data-testid={item}
                            onClick={handlers.onItemClick}
                        >
                            <button
                                data-testid={item + "-child"}
                                onClick={handlers.onChildClick}
                            />
                        </Reorder.Item>
                    ))}
                </Reorder.Group>
            </MockDrag>
        )
    }

    // A pointer-generated click, which browsers fire straight after pointerup
    const click = (element: Element) => fireEvent.click(element, { detail: 1 })

    function setup() {
        const handlers: Handlers = {
            onReorder: jest.fn(),
            onGroupClick: jest.fn(),
            onItemClick: jest.fn(),
            onChildClick: jest.fn(),
        }
        const result = render(<Component {...handlers} />)
        result.rerender(<Component {...handlers} />)

        // JSDOM has no layout, so give the items one
        act(() => {
            context.registerItem("a", {
                x: { min: 0, max: 100 },
                y: { min: 0, max: 50 },
            })
            context.registerItem("b", {
                x: { min: 0, max: 100 },
                y: { min: 50, max: 100 },
            })
        })

        return { ...handlers, ...result }
    }

    async function reorderDrag(element: Element, trigger?: Element) {
        const pointer = await drag(element, trigger).to(0, 100)
        pointer.end()
    }

    it.each([["a"], ["a-child"], ["group"]])(
        "doesn't click %s on the release that ends a reordering drag",
        async (target) => {
            const { onReorder, getByTestId, ...clicks } = setup()

            // Press where the click will land, so it's a child of the press
            const trigger = target === "group" ? undefined : getByTestId(target)
            await reorderDrag(getByTestId("a"), trigger)
            expect(onReorder).toBeCalledWith(["b", "a"], "a")

            click(getByTestId(target))
            expect(clicks.onItemClick).not.toBeCalled()
            expect(clicks.onChildClick).not.toBeCalled()
            expect(clicks.onGroupClick).not.toBeCalled()
        }
    )

    it("clicks after a drag that doesn't reorder", async () => {
        const { onReorder, onItemClick, onGroupClick, getByTestId } = setup()

        const pointer = await drag(getByTestId("a")).to(100, 0)
        pointer.end()
        expect(onReorder).not.toBeCalled()

        click(getByTestId("a"))
        expect(onItemClick).toBeCalledTimes(1)
        expect(onGroupClick).toBeCalledTimes(1)
    })

    it("clicks as normal once the drag has ended", async () => {
        const { onItemClick, getByTestId } = setup()

        await reorderDrag(getByTestId("a"))
        await nextFrame()

        click(getByTestId("a"))
        expect(onItemClick).toBeCalledTimes(1)
    })

    it("clicks as normal on the next press", async () => {
        const { onItemClick, getByTestId } = setup()

        await reorderDrag(getByTestId("a"))
        drag(getByTestId("b")).end()

        click(getByTestId("b"))
        expect(onItemClick).toBeCalledTimes(1)
    })

    it("fires clicks with no pointer press behind them", async () => {
        const { onChildClick, getByTestId } = setup()

        await reorderDrag(getByTestId("a"))

        // e.g. Enter on a focused button
        getByTestId("a-child").click()
        expect(onChildClick).toBeCalledTimes(1)
    })
})
