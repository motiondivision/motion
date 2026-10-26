import { fireEvent } from "@testing-library/react"
import { visualElementStore } from "motion-dom"
import { act, useContext, useState } from "react"
import { Reorder } from ".."
import { ReorderContext } from "../../../context/ReorderContext"
import { nextFrame } from "../../../gestures/__tests__/utils"
import { render } from "../../../jest.setup"
import { Reorder as ReorderM } from "../../../m"
import { domMax } from "../../../render/dom/features-max"
import { LazyMotion } from "../../LazyMotion"
import { ReorderAxis, ReorderContextProps } from "../types"

/**
 * JSDOM has no layout. Each group (ul) is a 100x300 column, 200px apart,
 * and each item (li) a 100x50 row in it, offset by its translate. Boxes are
 * derived from the DOM, so they follow React's commits and Motion's
 * renders like real layout would.
 */
function box(left: number, top: number, width: number, height: number) {
    return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON() {},
    } as DOMRect
}

function translate({ transform }: CSSStyleDeclaration) {
    let x = 0
    let y = 0
    transform.replace(
        /translate(X|Y|3d)\((-?[\d.]+)px(?:, (-?[\d.]+)px)?/g,
        (_, type, a, b) => {
            if (type === "Y") y += parseFloat(a)
            else x += parseFloat(a)
            if (type === "3d") y += parseFloat(b)
            return ""
        }
    )
    return { x, y }
}

function rect(this: HTMLElement): DOMRect {
    const group = this.closest("ul")
    // Or hidden, like display: none
    if (!group || this.closest("[hidden]")) return box(0, 0, 0, 0)

    // Or, with data-stacked, groups 350px apart down the page
    const order = Array.from(document.querySelectorAll("ul")).indexOf(group)
    const [left, top] = group.hasAttribute("data-stacked")
        ? [0, order * 350]
        : [order * 200, 0]
    if (this === group) return box(left, top, 100, 300)

    const { x, y } = translate(this.style)
    const index = Array.from(group.children).indexOf(this)
    return box(left + x, top + index * 50 + y, 100, 50)
}

/**
 * Elements under a point, topmost first: a moved (dragged) item is drawn
 * above other items, which are drawn above their groups.
 */
function elementsFromPoint(x: number, y: number) {
    const isUnder = (element: Element) => {
        const { left, top, right, bottom } = element.getBoundingClientRect()
        return x >= left && x < right && y >= top && y < bottom
    }
    const isMoved = (element: Element) =>
        translate((element as HTMLElement).style).x ||
        translate((element as HTMLElement).style).y
            ? 0
            : 1
    const items = Array.from(document.querySelectorAll("li"))
        .filter(isUnder)
        .sort((a, b) => isMoved(a) - isMoved(b))
    const groups = Array.from(document.querySelectorAll("ul")).filter(isUnder)

    return [...items, ...groups, document.body]
}

let restoreRect: jest.SpyInstance

beforeEach(() => {
    restoreRect = jest
        .spyOn(HTMLElement.prototype, "getBoundingClientRect")
        .mockImplementation(rect)
    document.elementsFromPoint = elementsFromPoint
})

afterEach(() => {
    // End any gesture a failed test left open, releasing its drag lock
    act(() => pointer("pointerup", document.body, 0, 0))
    restoreRect.mockRestore()
    delete (document as any).elementsFromPoint
})

/**
 * Pointer events at page (and, with no scroll, client) coordinates.
 */
function pointer(type: string, target: Element, x: number, y: number) {
    const event = new PointerEvent(type, {
        isPrimary: true,
        bubbles: true,
    } as PointerEventInit)
    Object.assign(event, { pageX: x, pageY: y, clientX: x, clientY: y })
    fireEvent(target, event)
}

/**
 * Press an item at its centre, then move the pointer by an offset from
 * there, a frame at a time.
 */
function drag(element: HTMLElement) {
    const { left, top } = element.getBoundingClientRect()
    const start = { x: left + 50, y: top + 25 }
    const latest = { ...start }

    act(() => pointer("pointerdown", element, start.x, start.y))

    const controls = {
        to: async (x: number, y: number) => {
            latest.x = start.x + x
            latest.y = start.y + y
            await act(async () => {
                pointer("pointermove", document.body, latest.x, latest.y)
                await nextFrame()
            })
            return controls
        },
        end: async () => {
            await act(async () => {
                pointer("pointerup", document.body, latest.x, latest.y)
                await nextFrame()
            })
        },
    }

    return controls
}

type Lists = Record<string, string[]>

interface BoardProps {
    initial: Lists
    axis?: ReorderAxis
    onReorder?: (id: string, order: string[], moved: string) => void
    reject?: (id: string) => boolean
    canMove?: (value: string, from: string[], to: string[]) => boolean
    namespace?: typeof Reorder
    /**
     * A group to hide, like display: none
     */
    hidden?: string
    /**
     * Stack the groups down the page, rather than side by side
     */
    stacked?: boolean
    [key: string]: any
}

/**
 * Sets the latest rendered Board's lists, as its app would.
 */
let setBoardLists: (update: (latest: Lists) => Lists) => void

function Board({
    initial,
    axis = "y",
    onReorder,
    reject,
    canMove,
    hidden,
    stacked,
    namespace: R = Reorder,
    ...itemProps
}: BoardProps) {
    const [lists, setLists] = useState(initial)
    setBoardLists = setLists

    return (
        <R.Board canMove={canMove}>
            {Object.keys(lists).map((id) => (
                <R.Group
                    key={id}
                    axis={axis}
                    hidden={id === hidden}
                    data-stacked={stacked || undefined}
                    data-testid={id}
                    values={lists[id]}
                    onReorder={(order: string[], moved: string) => {
                        onReorder?.(id, order, moved)
                        if (reject?.(id)) return
                        setLists((latest) => ({ ...latest, [id]: order }))
                    }}
                >
                    {lists[id].map((value) => (
                        <R.Item
                            key={value}
                            value={value}
                            data-testid={value}
                            {...itemProps}
                        >
                            {value}
                        </R.Item>
                    ))}
                </R.Group>
            ))}
        </R.Board>
    )
}

const lists = (container: HTMLElement) =>
    Object.fromEntries(
        Array.from(container.querySelectorAll("ul")).map((group) => [
            group.dataset.testid,
            Array.from(group.children).map(
                (item) => (item as HTMLElement).dataset.testid
            ),
        ])
    )

const offset = (element: Element) => {
    const visualElement = visualElementStore.get(element)!
    return {
        x: Math.round(visualElement.getValue("x")!.get() as number),
        y: Math.round(visualElement.getValue("y")!.get() as number),
    }
}

/**
 * Whether an item's whileDrag state is active. Items need an animation
 * prop, like whileDrag, to have an animation state.
 */
const isGrabbed = (element: Element) =>
    !!visualElementStore.get(element)?.animationState?.getState().whileDrag
        .isActive

describe("Reorder.Board", () => {
    it("moves an item into the group its centre is dragged over", async () => {
        const onReorder = jest.fn()
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c", "d"] }}
                onReorder={onReorder}
            />
        )

        // Between the groups: nothing moves
        const gesture = await drag(getByTestId("a")).to(100, 10)
        expect(onReorder).not.toBeCalled()

        // The centre of "a" is now at y=65 over B, past "c" (25) and
        // before "d" (75)
        await gesture.to(200, 40)
        expect(onReorder).toBeCalledTimes(2)
        expect(onReorder).toBeCalledWith("A", ["b"], "a")
        expect(onReorder).toBeCalledWith("B", ["c", "a", "d"], "a")
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a", "d"] })

        await gesture.end()
    })

    it("keeps dragging the item from where it was in its new group", async () => {
        const { container, getByTestId } = render(
            <Board initial={{ A: ["a", "b"], B: ["c", "d"] }} />
        )

        const gesture = await drag(getByTestId("a")).to(200, 40)
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a", "d"] })

        // Its new slot is 10px below where it was dragged to
        const moved = getByTestId("a")
        expect(moved.closest("ul")).toBe(getByTestId("B"))
        expect(offset(moved)).toEqual({ x: 0, y: -10 })

        // It follows the pointer from there
        await gesture.to(210, 60)
        expect(offset(moved)).toEqual({ x: 10, y: 10 })

        // And reorders within its new group: its bottom edge (110 + 50)
        // passes the centre of "d" (125)
        await gesture.to(210, 120)
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "d", "a"] })

        await gesture.end()
    })

    it("appends past the last item, and into an empty group", async () => {
        const { container, getByTestId } = render(
            <Board initial={{ A: ["a", "b"], B: ["c"], C: [] }} />
        )

        const gesture = await drag(getByTestId("a")).to(200, 100)
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a"], C: [] })

        await gesture.to(400, 100)
        expect(lists(container)).toEqual({ A: ["b"], B: ["c"], C: ["a"] })

        await gesture.end()
    })

    it("moves the item back to a group it came from", async () => {
        const { container, getByTestId } = render(
            <Board initial={{ A: ["a", "b"], B: ["c", "d"] }} />
        )

        const gesture = await drag(getByTestId("a")).to(200, 0)
        expect(lists(container)).toEqual({ A: ["b"], B: ["a", "c", "d"] })

        await gesture.to(0, 0)
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c", "d"] })

        await gesture.end()
    })

    it("snaps the item into its new slot on release, and ends the drag once", async () => {
        const onDragStart = jest.fn()
        const onDragEnd = jest.fn()
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a"], B: ["b"] }}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                dragTransition={{
                    bounceStiffness: 100000,
                    bounceDamping: 100000,
                }}
            />
        )

        const gesture = await drag(getByTestId("a")).to(200, 60)
        await gesture.to(200, 70)
        await gesture.end()
        expect(lists(container)).toEqual({ A: [], B: ["b", "a"] })

        const moved = getByTestId("a")
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 500))
        })
        expect(offset(moved)).toEqual({ x: 0, y: 0 })
        expect(onDragStart).toBeCalledTimes(1)
        expect(onDragEnd).toBeCalledTimes(1)
    })

    it("keeps whileDrag on the moved item", async () => {
        const { getByTestId } = render(
            <Board
                initial={{ A: ["a"], B: ["b"] }}
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const gesture = await drag(getByTestId("a")).to(200, 60)
        expect(getByTestId("a").closest("ul")).toBe(getByTestId("B"))

        // Its drag carries on from the next frame
        await act(nextFrame)
        expect(isGrabbed(getByTestId("a"))).toBe(true)

        await gesture.end()
        expect(isGrabbed(getByTestId("a"))).toBe(false)
    })

    it("ends the drag if it's released before the drag carries on", async () => {
        const onDragEnd = jest.fn()
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a"], B: ["b"] }}
                whileDrag={{ opacity: 0.5 }}
                onDragEnd={onDragEnd}
            />
        )

        await drag(getByTestId("a")).to(100, 10)

        // Over B, and released in the same act, before React commits the move
        await act(async () => {
            pointer("pointermove", document.body, 250, 85)
            await nextFrame()
            expect(getByTestId("a").closest("ul")).toBe(getByTestId("A"))
            pointer("pointerup", document.body, 250, 85)
        })
        await act(nextFrame)

        expect(lists(container)).toEqual({ A: [], B: ["b", "a"] })
        expect(isGrabbed(getByTestId("a"))).toBe(false)
        expect(onDragEnd).toBeCalledTimes(1)
    })

    it("carries the drag on from where the pointer is when React commits the move", async () => {
        const { getByTestId } = render(
            <Board initial={{ A: ["a", "b"], B: ["c", "d"] }} />
        )

        const gesture = await drag(getByTestId("a")).to(100, 10)

        // Over B, then on another 30px before React commits the move
        await act(async () => {
            pointer("pointermove", document.body, 250, 65)
            await nextFrame()
            pointer("pointermove", document.body, 280, 65)
            await nextFrame()
        })
        await act(nextFrame)

        // Its slot's centre is at 250, 75: it's still under the pointer
        const moved = getByTestId("a")
        expect(moved.closest("ul")).toBe(getByTestId("B"))
        expect(offset(moved)).toEqual({ x: 30, y: -10 })

        await gesture.end()
    })

    it("carries how the item looks into its new group", async () => {
        const { getByTestId } = render(
            <Board
                initial={{ A: ["a"], B: ["b"] }}
                whileDrag={{ scale: 1.5 }}
                transition={{ duration: 0.05 }}
            />
        )
        const scale = () =>
            visualElementStore.get(getByTestId("a"))!.getValue("scale")?.get()
        const wait = () =>
            act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 200))
            })

        const gesture = await drag(getByTestId("a")).to(100, 10)
        await wait()
        expect(scale()).toBe(1.5)

        // Its whileDrag doesn't start over in its new group
        await gesture.to(200, 60)
        expect(getByTestId("a").closest("ul")).toBe(getByTestId("B"))
        expect(scale()).toBe(1.5)

        // And ends on release
        await gesture.end()
        await wait()
        expect(scale()).toBe(1)
    })

    it("lets items in a board move on both axes", async () => {
        const { getByTestId } = render(<Board initial={{ A: ["a", "b"] }} />)

        const gesture = await drag(getByTestId("a")).to(30, 10)
        expect(offset(getByTestId("a"))).toEqual({ x: 30, y: 10 })

        await gesture.end()
    })

    it("leaves the item where it is if the groups don't take it", async () => {
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c", "d"] }}
                reject={() => true}
            />
        )

        const gesture = await drag(getByTestId("a")).to(200, 40)
        await gesture.to(210, 50)
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c", "d"] })

        // Still dragged by the same gesture
        expect(offset(getByTestId("a"))).toEqual({ x: 210, y: 50 })

        await gesture.end()
    })

    it("works with Reorder from the m entry in LazyMotion", async () => {
        const { container, getByTestId } = render(
            <LazyMotion features={domMax}>
                <Board
                    initial={{ A: ["a", "b"], B: ["c", "d"] }}
                    namespace={ReorderM as typeof Reorder}
                />
            </LazyMotion>
        )

        const gesture = await drag(getByTestId("a")).to(200, 40)
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a", "d"] })
        await gesture.end()
    })

    it("scrolls the container around the groups across them, rather than the item's column", async () => {
        function ScrollingBoard() {
            const [lists, setLists] = useState<Lists>({
                A: ["a"],
                B: ["b"],
                C: [],
            })

            return (
                <Reorder.Board>
                    <div data-testid="board">
                        {Object.keys(lists).map((id) => (
                            <div key={id} data-testid={`${id}-column`}>
                                <Reorder.Group
                                    axis="y"
                                    data-testid={id}
                                    values={lists[id]}
                                    onReorder={(order) =>
                                        setLists((latest) => ({
                                            ...latest,
                                            [id]: order,
                                        }))
                                    }
                                >
                                    {lists[id].map((value) => (
                                        <Reorder.Item
                                            key={value}
                                            value={value}
                                            data-testid={value}
                                        >
                                            {value}
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>
                            </div>
                        ))}
                    </div>
                </Reorder.Board>
            )
        }

        const { getByTestId } = render(<ScrollingBoard />)

        /**
         * A 400px wide board that scrolls across to its last group, around
         * columns that scroll down. A browser computes a column's
         * overflow-x as auto too, and an item dragged out of it widens its
         * scrollable overflow, so it can scroll across a little as well.
         */
        const scrollLeft = (element: HTMLElement) => {
            let value = 0
            Object.defineProperty(element, "scrollLeft", {
                get: () => value,
                set: (latest) => (value = latest),
            })
            return () => value
        }
        const metrics = (
            element: HTMLElement,
            getRect: () => DOMRect,
            scrollWidth: number
        ) => {
            element.style.overflowX = "auto"
            element.style.overflowY = "auto"
            element.getBoundingClientRect = getRect
            const { width, height } = getRect()
            Object.defineProperties(element, {
                clientWidth: { value: width },
                clientHeight: { value: height },
                scrollWidth: { value: scrollWidth },
                scrollHeight: { value: height },
            })
            return scrollLeft(element)
        }

        const board = metrics(
            getByTestId("board"),
            () => box(0, 0, 400, 300),
            600
        )
        const columns = ["A", "B", "C"].map((id) => {
            const group = getByTestId(id)
            return metrics(
                getByTestId(`${id}-column`),
                () => group.getBoundingClientRect(),
                250
            )
        })

        // Into B, then on towards the board's right edge, short of C
        const gesture = await drag(getByTestId("a")).to(200, 0)
        expect(getByTestId("a").closest("ul")).toBe(getByTestId("B"))
        await gesture.to(320, 0)
        await gesture.to(340, 0)

        expect(board()).toBeGreaterThan(0)
        expect(columns.map((column) => column())).toEqual([0, 0, 0])

        await gesture.end()
    })

    it("drops into a virtualized group by the items it shows", async () => {
        let latest: Lists = {}
        function Virtualized({ shown }: { shown: number }) {
            const [lists, setLists] = useState<Lists>({
                A: ["a"],
                B: ["c", "d", "e"],
            })
            latest = lists
            return (
                <Reorder.Board>
                    {Object.keys(lists).map((id) => (
                        <Reorder.Group
                            key={id}
                            axis="y"
                            data-testid={id}
                            values={lists[id]}
                            onReorder={(order: string[]) =>
                                setLists((l) => ({ ...l, [id]: order }))
                            }
                        >
                            {lists[id]
                                .slice(0, id === "B" ? shown : undefined)
                                .map((value) => (
                                    <Reorder.Item
                                        key={value}
                                        value={value}
                                        data-testid={value}
                                    />
                                ))}
                        </Reorder.Group>
                    ))}
                </Reorder.Board>
            )
        }
        const { getByTestId, rerender } = render(<Virtualized shown={3} />)
        await act(nextFrame)

        // Scrolled: only "c" is still rendered, "d" and "e" stay in values
        rerender(<Virtualized shown={1} />)
        await act(nextFrame)

        // Its centre just below "c"
        const gesture = await drag(getByTestId("a")).to(200, 35)
        expect(latest).toEqual({ A: [], B: ["c", "a", "d", "e"] })
        await gesture.end()
    })

    it("lets the item move again in a later gesture once the groups refused it", async () => {
        let refuse = true
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c", "d"] }}
                reject={() => refuse}
                dragTransition={{
                    bounceStiffness: 100000,
                    bounceDamping: 100000,
                }}
            />
        )

        let gesture = await drag(getByTestId("a")).to(200, 40)
        await gesture.end()
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 300))
        })
        expect(offset(getByTestId("a"))).toEqual({ x: 0, y: 0 })

        refuse = false
        gesture = await drag(getByTestId("a")).to(200, 40)
        await gesture.to(200, 41)
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a", "d"] })
        await gesture.end()
    })

    it("leaves the item in its group while canMove refuses the move", async () => {
        const onReorder = jest.fn()
        // Up to two items in a group
        const canMove = jest.fn(
            (_: string, __: string[], to: string[]) => to.length < 2
        )
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c", "d"], C: [] }}
                onReorder={onReorder}
                canMove={canMove}
            />
        )

        // Over B, which is full
        const gesture = await drag(getByTestId("a")).to(200, 10)
        expect(canMove).toBeCalledWith("a", ["a", "b"], ["c", "d"])
        expect(onReorder).not.toBeCalled()
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c", "d"], C: [] })
        expect(offset(getByTestId("a"))).toEqual({ x: 200, y: 10 })

        // The same gesture can still take it on to C
        await gesture.to(400, 10)
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "d"], C: ["a"] })
        expect(canMove).toHaveBeenLastCalledWith("a", ["a", "b"], [])

        await gesture.end()
    })

    it("doesn't move items between a group and a group inside its items", async () => {
        // A list of columns, each holding a list of cards
        function Columns() {
            const [columns, setColumns] = useState(["x", "y"])
            const [cards, setCards] = useState<Lists>({ x: ["a"], y: ["b"] })
            return (
                <Reorder.Board>
                    <Reorder.Group
                        axis="y"
                        data-testid="columns"
                        values={columns}
                        onReorder={setColumns}
                    >
                        {columns.map((id) => (
                            <Reorder.Item key={id} value={id} data-testid={id}>
                                <Reorder.Group
                                    axis="y"
                                    data-testid={`${id}-cards`}
                                    values={cards[id]}
                                    onReorder={(order) =>
                                        setCards((latest) => ({
                                            ...latest,
                                            [id]: order,
                                        }))
                                    }
                                >
                                    {cards[id].map((card) => (
                                        <Reorder.Item
                                            key={card}
                                            value={card}
                                            data-testid={card}
                                        />
                                    ))}
                                </Reorder.Group>
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>
                </Reorder.Board>
            )
        }
        const { container, getByTestId } = render(<Columns />)
        // Which column holds which cards. Columns may reorder among themselves.
        const state = () => {
            const { columns, ...cards } = lists(container)
            return { columns: [...columns].sort(), ...cards }
        }
        const initial = state()

        // A card over the list of columns, outside any list of cards
        let gesture = await drag(getByTestId("a")).to(-170, 0)
        expect(state()).toEqual(initial)
        await gesture.end()

        // A column over another column's cards
        gesture = await drag(getByTestId("y")).to(200, -50)
        expect(state()).toEqual(initial)
        await gesture.end()
    })

    it("carries on after the dragged item unmounts mid-drag", async () => {
        const { container, getByTestId } = render(
            <Board initial={{ A: ["a", "b"], B: ["c"] }} />
        )

        const gesture = await drag(getByTestId("a")).to(10, 10)
        // The app removes it
        act(() => setBoardLists((latest) => ({ ...latest, A: ["b"] })))
        await gesture.to(20, 20)
        await gesture.end()

        // Items still move between groups
        const next = await drag(getByTestId("b")).to(200, 40)
        await next.to(200, 41)
        expect(lists(container)).toEqual({ A: [], B: ["c", "b"] })
        await next.end()
    })
})

describe("Reorder without a Board", () => {
    it("doesn't move items between groups", async () => {
        const onReorder = jest.fn()
        const Groups = () => {
            const [a, setA] = useState(["a", "b"])
            const [c, setC] = useState(["c", "d"])
            return (
                <>
                    <Reorder.Group axis="y" values={a} onReorder={setA}>
                        {a.map((value) => (
                            <Reorder.Item
                                key={value}
                                value={value}
                                data-testid={value}
                            />
                        ))}
                    </Reorder.Group>
                    <Reorder.Group
                        axis="y"
                        values={c}
                        onReorder={(order) => {
                            onReorder(order)
                            setC(order)
                        }}
                    >
                        {c.map((value) => (
                            <Reorder.Item
                                key={value}
                                value={value}
                                data-testid={value}
                            />
                        ))}
                    </Reorder.Group>
                </>
            )
        }
        const { getByTestId } = render(<Groups />)

        const gesture = await drag(getByTestId("a")).to(200, 40)
        expect(onReorder).not.toBeCalled()
        expect(getByTestId("a").closest("ul")!.contains(getByTestId("b"))).toBe(
            true
        )
        // And it only moves along its axis
        expect(offset(getByTestId("a")).x).toBe(0)

        await gesture.end()
    })
})

describe("Reorder with unmounted (e.g. virtualized) items", () => {
    it.each([
        ["outside a Board", false, undefined],
        ["inside a Board", true, undefined],
        // A callback ref's cleanup is called rather than the ref with null
        ["with a callback ref that returns a cleanup", false, () => () => {}],
    ])(
        "doesn't keep their elements %s",
        async (_, inBoard, itemRef) => {
            const captured: { context?: ReorderContextProps<number> | null } =
                {}
            const Capture = () => {
                captured.context = useContext(ReorderContext)
                return null
            }
            const values = [0, 1, 2, 3, 4, 5]
            const List = ({ from }: { from: number }) => {
                const group = (
                    <Reorder.Group axis="y" values={values} onReorder={() => {}}>
                        <Capture />
                        {values.slice(from, from + 3).map((value) => (
                            <Reorder.Item
                                key={value}
                                value={value}
                                ref={itemRef}
                            />
                        ))}
                    </Reorder.Group>
                )
                return inBoard ? <Reorder.Board>{group}</Reorder.Board> : group
            }
            const { rerender } = render(<List from={0} />)
            await act(nextFrame)
            rerender(<List from={3} />)
            await act(nextFrame)

            // Elements, or refs to them, no longer in the document
            const detached = captured
                .context!.getOrder()
                .filter((data) =>
                    Object.values(data).some((field) => {
                        const element = field?.current ?? field
                        return element instanceof Element && !element.isConnected
                    })
                )
            expect(detached).toEqual([])
        }
    )
})

describe("Reorder.Board keyboard", () => {
    const press = (element: Element, key: string) => {
        let result = true
        act(() => {
            result = fireEvent.keyDown(element, { key })
        })
        return result
    }

    function setup(initial: Lists = { A: ["a", "b"], B: ["c", "d"] }) {
        const onReorder = jest.fn()
        const result = render(
            <Board
                initial={initial}
                onReorder={onReorder}
                whileDrag={{ opacity: 0.5 }}
                /**
                 * Without layout animations: a keyboard move lands by where
                 * the items are drawn, so an item still animating into its
                 * slot would make the slot depend on timing.
                 */
                transition={{ type: false }}
            />
        )
        return { onReorder, ...result }
    }

    it("moves a grabbed item to the next group across its axis", async () => {
        const { container, getByTestId } = setup()

        const a = getByTestId("a")
        act(() => a.focus())
        press(a, " ")

        expect(press(a, "ArrowRight")).toBe(false)
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["b"], B: ["a", "c", "d"] })

        // Focus and the grab move with it
        const moved = getByTestId("a")
        expect(moved.closest("ul")).toBe(getByTestId("B"))
        expect(document.activeElement).toBe(moved)
        expect(isGrabbed(moved)).toBe(true)

        // Arrows along the axis now move it within its new group
        press(moved, "ArrowDown")
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a", "d"] })

        press(moved, "ArrowLeft")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["b", "a"], B: ["c", "d"] })
        expect(document.activeElement).toBe(getByTestId("a"))

        // Space drops it
        press(getByTestId("a"), " ")
        expect(isGrabbed(getByTestId("a"))).toBe(false)
    })

    it("moves to another group on an arrow sent before React renders the grab", async () => {
        const { container, getByTestId } = setup()

        const a = getByTestId("a")
        act(() => a.focus())
        // As Cypress sends them: both keys before React renders
        act(() => {
            fireEvent.keyDown(a, { key: " " })
            fireEvent.keyDown(a, { key: "ArrowRight" })
        })
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["b"], B: ["a", "c", "d"] })
        expect(document.activeElement).toBe(getByTestId("a"))
        expect(isGrabbed(getByTestId("a"))).toBe(true)
    })

    it("leaves arrows to the browser where there's no group", () => {
        const { getByTestId, onReorder } = setup()

        const a = getByTestId("a")
        press(a, " ")
        expect(press(a, "ArrowLeft")).toBe(true)
        expect(onReorder).not.toBeCalled()
    })

    it("restores the item to the group and slot it was grabbed from on Escape", async () => {
        const { container, getByTestId } = setup()

        const b = getByTestId("b")
        act(() => b.focus())
        press(b, " ")
        press(b, "ArrowRight")
        await nextFrame()
        press(getByTestId("b"), "ArrowDown")
        expect(lists(container)).toEqual({ A: ["a"], B: ["c", "d", "b"] })

        expect(press(getByTestId("b"), "Escape")).toBe(false)
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c", "d"] })
        expect(document.activeElement).toBe(getByTestId("b"))
        expect(isGrabbed(getByTestId("b"))).toBe(false)
    })

    it("doesn't move a grabbed item into a hidden group", () => {
        const { container, getByTestId } = render(
            <Board
                initial={{ H: ["h"], A: ["a"], B: ["b"] }}
                hidden="H"
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const a = getByTestId("a")
        act(() => a.focus())
        press(a, " ")
        expect(press(a, "ArrowLeft")).toBe(true)
        expect(lists(container)).toEqual({ H: ["h"], A: ["a"], B: ["b"] })
        expect(document.activeElement).toBe(a)
    })

    it("forgets a refused move once the item is dropped", async () => {
        let refuse = true
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c"] }}
                reject={() => refuse}
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const a = getByTestId("a")
        act(() => a.focus())
        press(a, " ")
        press(a, "ArrowRight")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c"] })
        press(a, " ")
        act(() => getByTestId("c").focus())

        // Later, the app moves it itself
        refuse = false
        act(() =>
            setBoardLists((latest) => ({ A: ["b"], B: ["a", ...latest.B] }))
        )
        await act(nextFrame)

        expect(document.activeElement).toBe(getByTestId("c"))
        expect(isGrabbed(getByTestId("a"))).toBe(false)
    })

    it("skips a group that canMove refuses for the next one that way", async () => {
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a"], B: ["b", "c"], C: [], D: ["d", "e"] }}
                // Up to two items in a group
                canMove={(_, __, to) => to.length < 2}
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const a = getByTestId("a")
        act(() => a.focus())
        press(a, " ")
        expect(press(a, "ArrowRight")).toBe(false)
        await nextFrame()
        const moved = { A: [], B: ["b", "c"], C: ["a"], D: ["d", "e"] }
        expect(lists(container)).toEqual(moved)
        expect(document.activeElement).toBe(getByTestId("a"))

        // No group takes it further that way
        expect(press(getByTestId("a"), "ArrowRight")).toBe(true)
        expect(lists(container)).toEqual(moved)
    })

    it("returns the item on Escape whatever canMove says", async () => {
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c"] }}
                // Nothing moves into A
                canMove={(_, __, to) => !to.includes("a")}
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const b = getByTestId("b")
        act(() => b.focus())
        press(b, " ")
        press(b, "ArrowRight")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["a"], B: ["c", "b"] })

        press(getByTestId("b"), "Escape")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c"] })
    })

    it("only moves past either end into a group that way, not one beside it", async () => {
        const { container, getByTestId } = setup({ A: ["a"], B: ["b"] })

        // A and B are side by side: neither's last item has anywhere to go
        // down, to the right or the left
        for (const id of ["a", "b"]) {
            const item = getByTestId(id)
            act(() => item.focus())
            press(item, " ")
            press(item, "ArrowDown")
            await nextFrame()
            expect(lists(container)).toEqual({ A: ["a"], B: ["b"] })
            expect(document.activeElement).toBe(getByTestId(id))
            press(getByTestId(id), " ")
        }
    })

    it("moves past either end into the group that way", async () => {
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c"] }}
                stacked
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const b = getByTestId("b")
        act(() => b.focus())
        press(b, " ")
        expect(press(b, "ArrowDown")).toBe(false)
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["a"], B: ["b", "c"] })

        press(getByTestId("b"), "ArrowUp")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c"] })
    })

    it("waits for a move to another group to render before moving the item again", async () => {
        const { container, getByTestId } = setup()

        const a = getByTestId("a")
        act(() => a.focus())
        // As a test runner can send them, or as a user can type while a
        // transition renders the move: all before React renders it
        act(() => {
            fireEvent.keyDown(a, { key: " " })
            fireEvent.keyDown(a, { key: "ArrowRight" })
            fireEvent.keyDown(a, { key: "ArrowDown" })
        })
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["b"], B: ["a", "c", "d"] })

        // Once it has, arrows move it again
        press(getByTestId("a"), "ArrowDown")
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a", "d"] })
    })

    it("waits for a move to another group to render before returning the item on Escape", async () => {
        const { container, getByTestId } = setup()

        const a = getByTestId("a")
        act(() => a.focus())
        press(a, " ")
        press(a, "ArrowDown")
        expect(lists(container)).toEqual({ A: ["b", "a"], B: ["c", "d"] })

        // Escape before React renders the move
        act(() => {
            fireEvent.keyDown(getByTestId("a"), { key: "ArrowRight" })
            fireEvent.keyDown(getByTestId("a"), { key: "Escape" })
        })
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["b"], B: ["c", "a", "d"] })
        expect(document.activeElement).toBe(getByTestId("a"))

        // Once it has, Escape returns it
        press(getByTestId("a"), "Escape")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["a", "b"], B: ["c", "d"] })
    })

    it("leaves focus where it is when a keyboard move lands later", async () => {
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c"] }}
                // Only the group it joins ignores the move: the item disappears
                reject={(id) => id === "B"}
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const a = getByTestId("a")
        act(() => a.focus())
        press(a, " ")
        press(a, "ArrowRight")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["b"], B: ["c"] })

        // The user carries on elsewhere
        act(() => getByTestId("c").focus())

        // Later (e.g. an undo), the app puts it there itself
        act(() => setBoardLists((latest) => ({ ...latest, B: ["c", "a"] })))
        await act(nextFrame)

        expect(document.activeElement).toBe(getByTestId("c"))
        expect(isGrabbed(getByTestId("a"))).toBe(false)
    })

    it("moves an item again after a keyboard move that never landed", async () => {
        const { container, getByTestId } = render(
            <Board
                initial={{ A: ["a", "b"], B: ["c"] }}
                // Only the group it joins ignores the move: the item disappears
                reject={(id) => id === "B"}
                whileDrag={{ opacity: 0.5 }}
            />
        )

        const a = getByTestId("a")
        act(() => a.focus())
        press(a, " ")
        press(a, "ArrowRight")
        await nextFrame()
        expect(lists(container)).toEqual({ A: ["b"], B: ["c"] })

        // The app puts it back (e.g. an undo), and it's grabbed again
        act(() => setBoardLists((latest) => ({ ...latest, A: ["a", "b"] })))
        await act(nextFrame)
        const restored = getByTestId("a")
        act(() => restored.focus())
        press(restored, " ")
        expect(press(restored, "ArrowDown")).toBe(false)
        expect(lists(container)).toEqual({ A: ["b", "a"], B: ["c"] })
    })
})
