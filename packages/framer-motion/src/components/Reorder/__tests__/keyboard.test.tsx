import { fireEvent } from "@testing-library/react"
import { motionValue, visualElementStore } from "motion-dom"
import { act, useState } from "react"
import { Reorder } from ".."
import { nextFrame } from "../../../gestures/__tests__/utils"
import { render } from "../../../jest.setup"
import { ReorderAxis } from "../types"

const List = ({
    initial = ["a", "b", "c"],
    axis = "y",
    onReorder,
    dir,
    ...itemProps
}: {
    initial?: string[]
    axis?: ReorderAxis
    onReorder?: (values: string[]) => void
    dir?: "rtl"
    [key: string]: any
}) => {
    const [items, setItems] = useState(initial)

    return (
        <Reorder.Group
            axis={axis}
            values={items}
            style={dir ? { direction: dir } : undefined}
            onReorder={(newOrder) => {
                onReorder?.(newOrder)
                setItems(newOrder)
            }}
        >
            {items.map((item) => (
                <Reorder.Item
                    key={item}
                    value={item}
                    data-testid={item}
                    whileDrag={{ opacity: 0.5 }}
                    {...itemProps}
                >
                    {item}
                    <input data-testid={`${item}-input`} />
                </Reorder.Item>
            ))}
        </Reorder.Group>
    )
}

const order = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("li")).map((li) =>
        li.getAttribute("data-testid")
    )

/**
 * Returns whether the key was left to the browser (not prevented).
 */
const press = (element: Element, key: string, init: object = {}) => {
    let result = true
    act(() => {
        result = fireEvent.keyDown(element, { key, ...init })
    })
    return result
}

/**
 * A grabbed item has its whileDrag state active. List gives items a
 * whileDrag, as only items with animation props have an animation state.
 */
const isGrabbed = (element: Element) =>
    !!visualElementStore.get(element)?.animationState?.getState().whileDrag
        .isActive

describe("Reorder keyboard", () => {
    it("makes items focusable", () => {
        const { getByTestId } = render(<List />)
        expect(getByTestId("a").tabIndex).toBe(0)
    })

    it("lets items override tabIndex", () => {
        const { container } = render(
            <Reorder.Group values={["a"]} onReorder={() => {}}>
                <Reorder.Item value="a" tabIndex={-1} />
            </Reorder.Group>
        )
        expect(container.querySelector("li")!.tabIndex).toBe(-1)
    })

    it("leaves arrows to the browser until an item is grabbed", () => {
        const onReorder = jest.fn()
        const { getByTestId } = render(<List onReorder={onReorder} />)

        expect(press(getByTestId("a"), "ArrowDown")).toBe(true)
        expect(press(getByTestId("b"), "ArrowUp")).toBe(true)
        expect(onReorder).not.toBeCalled()
    })

    it("grabs with Space, moves with arrows and drops with Space", () => {
        const onReorder = jest.fn()
        const { container, getByTestId } = render(
            <List onReorder={onReorder} />
        )
        const a = getByTestId("a")

        expect(isGrabbed(a)).toBe(false)
        expect(press(a, " ")).toBe(false)
        expect(isGrabbed(a)).toBe(true)
        expect(onReorder).not.toBeCalled()

        expect(press(a, "ArrowDown")).toBe(false)
        expect(onReorder).toHaveBeenLastCalledWith(["b", "a", "c"])
        expect(order(container)).toEqual(["b", "a", "c"])
        expect(isGrabbed(a)).toBe(true)

        press(a, "ArrowDown")
        expect(order(container)).toEqual(["b", "c", "a"])

        press(a, "ArrowUp")
        expect(order(container)).toEqual(["b", "a", "c"])

        expect(press(a, " ")).toBe(false)
        expect(isGrabbed(a)).toBe(false)
        expect(order(container)).toEqual(["b", "a", "c"])

        // Dropped: arrows are the browser's again
        expect(press(a, "ArrowDown")).toBe(true)
        expect(order(container)).toEqual(["b", "a", "c"])
        expect(onReorder).toBeCalledTimes(3)
    })

    it("moves on an arrow sent before React renders the grab", () => {
        const { container, getByTestId } = render(<List />)
        const a = getByTestId("a")

        // A test runner can send keys faster than React renders
        act(() => {
            fireEvent.keyDown(a, { key: " " })
            fireEvent.keyDown(a, { key: "ArrowDown" })
        })
        expect(order(container)).toEqual(["b", "a", "c"])
        expect(isGrabbed(a)).toBe(true)
    })

    it("drops when focus leaves before React renders the grab", () => {
        const { getByTestId } = render(<List />)
        const a = getByTestId("a")

        act(() => a.focus())
        act(() => {
            fireEvent.keyDown(a, { key: " " })
            getByTestId("c").focus()
        })
        expect(isGrabbed(a)).toBe(false)
        expect(press(a, "ArrowDown")).toBe(true)
    })

    it("leaves Enter alone so it keeps its tap meaning", () => {
        const onReorder = jest.fn()
        const { getByTestId } = render(<List onReorder={onReorder} />)
        const b = getByTestId("b")

        expect(press(b, "Enter")).toBe(true)
        expect(isGrabbed(b)).toBe(false)
        press(b, "ArrowUp")
        expect(onReorder).not.toBeCalled()
    })

    it("ignores a held Space", () => {
        const { getByTestId } = render(<List />)
        const a = getByTestId("a")

        press(a, " ")
        press(a, " ", { repeat: true })
        expect(isGrabbed(a)).toBe(true)
    })

    it("cancels with Escape, restoring the order from the grab", () => {
        const onReorder = jest.fn()
        const { container, getByTestId } = render(
            <List onReorder={onReorder} />
        )
        const a = getByTestId("a")

        press(a, " ")
        press(a, "ArrowDown")
        press(a, "ArrowDown")
        expect(order(container)).toEqual(["b", "c", "a"])

        expect(press(a, "Escape")).toBe(false)
        expect(onReorder).toHaveBeenLastCalledWith(["a", "b", "c"])
        expect(order(container)).toEqual(["a", "b", "c"])
        expect(isGrabbed(a)).toBe(false)

        expect(press(a, "ArrowDown")).toBe(true)
        expect(order(container)).toEqual(["a", "b", "c"])
    })

    it("restores the order from the latest grab", () => {
        const { container, getByTestId } = render(<List />)
        const a = getByTestId("a")

        press(a, " ")
        press(a, "ArrowDown")
        press(a, " ")
        press(a, " ")
        press(a, "ArrowDown")
        expect(order(container)).toEqual(["b", "c", "a"])

        press(a, "Escape")
        expect(order(container)).toEqual(["b", "a", "c"])
    })

    it("cancelling without a move doesn't reorder", () => {
        const onReorder = jest.fn()
        const { getByTestId } = render(<List onReorder={onReorder} />)
        const a = getByTestId("a")

        press(a, " ")
        expect(press(a, "Escape")).toBe(false)
        expect(isGrabbed(a)).toBe(false)
        expect(onReorder).not.toBeCalled()
    })

    it("leaves Escape to the browser when nothing is grabbed", () => {
        const { getByTestId } = render(<List />)
        expect(press(getByTestId("a"), "Escape")).toBe(true)
    })

    it("drops, keeping the order, when focus leaves the item", () => {
        const onReorder = jest.fn()
        const { container, getByTestId } = render(
            <List onReorder={onReorder} />
        )
        const a = getByTestId("a")

        act(() => a.focus())
        press(a, " ")
        press(a, "ArrowDown")
        expect(document.activeElement).toBe(a)
        expect(isGrabbed(a)).toBe(true)

        act(() => getByTestId("c").focus())
        expect(isGrabbed(a)).toBe(false)
        expect(order(container)).toEqual(["b", "a", "c"])

        act(() => a.focus())
        expect(press(a, "ArrowDown")).toBe(true)
        expect(order(container)).toEqual(["b", "a", "c"])
        expect(onReorder).toBeCalledTimes(1)
    })

    it("ignores arrows across the axis and other keys while grabbed", () => {
        const onReorder = jest.fn()
        const { getByTestId } = render(<List onReorder={onReorder} />)
        const b = getByTestId("b")

        press(b, " ")
        for (const key of ["ArrowLeft", "ArrowRight", "Tab", "a"]) {
            expect(press(b, key)).toBe(true)
        }
        expect(onReorder).not.toBeCalled()
        expect(isGrabbed(b)).toBe(true)
    })

    it("ignores keys with Alt, Ctrl or Meta held", () => {
        const onReorder = jest.fn()
        const { getByTestId } = render(<List onReorder={onReorder} />)
        const a = getByTestId("a")

        for (const modifier of ["altKey", "ctrlKey", "metaKey"]) {
            expect(press(a, " ", { [modifier]: true })).toBe(true)
        }
        expect(isGrabbed(a)).toBe(false)

        press(a, " ")
        for (const modifier of ["altKey", "ctrlKey", "metaKey"]) {
            expect(press(a, "ArrowDown", { [modifier]: true })).toBe(true)
            expect(press(a, "Escape", { [modifier]: true })).toBe(true)
        }
        expect(onReorder).not.toBeCalled()
        expect(isGrabbed(a)).toBe(true)

        press(a, "ArrowDown")
        expect(onReorder).toBeCalledWith(["b", "a", "c"])
    })

    it("does nothing past either end", () => {
        const onReorder = jest.fn()
        const { getByTestId } = render(<List onReorder={onReorder} />)

        press(getByTestId("a"), " ")
        press(getByTestId("a"), "ArrowUp")
        press(getByTestId("c"), " ")
        press(getByTestId("c"), "ArrowDown")
        expect(onReorder).not.toBeCalled()
    })

    it("moves with left and right on the x axis", () => {
        const { container, getByTestId } = render(<List axis="x" />)
        const a = getByTestId("a")

        press(a, " ")
        press(a, "ArrowRight")
        expect(order(container)).toEqual(["b", "a", "c"])

        expect(press(a, "ArrowDown")).toBe(true)
        expect(order(container)).toEqual(["b", "a", "c"])

        press(a, "ArrowLeft")
        expect(order(container)).toEqual(["a", "b", "c"])
    })

    it("flips left and right in RTL", () => {
        const { container, getByTestId } = render(<List axis="x" dir="rtl" />)

        press(getByTestId("a"), " ")
        press(getByTestId("a"), "ArrowLeft")
        expect(order(container)).toEqual(["b", "a", "c"])
    })

    it("accepts every arrow on the xy axis", () => {
        const { container, getByTestId } = render(<List axis="xy" />)
        const a = getByTestId("a")

        press(a, " ")
        press(a, "ArrowRight")
        expect(order(container)).toEqual(["b", "a", "c"])
        press(a, "ArrowDown")
        expect(order(container)).toEqual(["b", "c", "a"])
        press(a, "ArrowUp")
        expect(order(container)).toEqual(["b", "a", "c"])
        press(a, "ArrowLeft")
        expect(order(container)).toEqual(["a", "b", "c"])
    })

    it("ignores keys from inside the item", () => {
        const onReorder = jest.fn()
        const { getByTestId } = render(<List onReorder={onReorder} />)
        const input = getByTestId("a-input")

        expect(press(input, " ")).toBe(true)
        expect(press(input, "Enter")).toBe(true)
        expect(isGrabbed(getByTestId("a"))).toBe(false)

        press(getByTestId("a"), " ")
        expect(press(input, "ArrowDown")).toBe(true)
        expect(press(input, "Escape")).toBe(true)
        expect(onReorder).not.toBeCalled()
        expect(isGrabbed(getByTestId("a"))).toBe(true)
    })

    it("lets the item's onKeyDown prevent grabbing and moving", () => {
        const onReorder = jest.fn()
        let prevent = true
        const onKeyDown = jest.fn(
            (event: React.KeyboardEvent) => prevent && event.preventDefault()
        )
        const { getByTestId } = render(
            <List onReorder={onReorder} onKeyDown={onKeyDown} />
        )
        const a = getByTestId("a")

        press(a, " ")
        expect(onKeyDown).toBeCalledTimes(1)
        expect(isGrabbed(a)).toBe(false)

        prevent = false
        press(a, " ")
        expect(isGrabbed(a)).toBe(true)

        prevent = true
        press(a, "ArrowDown")
        press(a, "Escape")
        expect(onReorder).not.toBeCalled()
        expect(isGrabbed(a)).toBe(true)
    })

    it("keeps focus and the grab on the moved item", () => {
        const { getByTestId } = render(<List />)
        const b = getByTestId("b")

        act(() => b.focus())
        press(b, " ")
        press(b, "ArrowUp")
        expect(document.activeElement).toBe(b)
        expect(isGrabbed(b)).toBe(true)

        press(b, "ArrowDown")
        press(b, "ArrowDown")
        expect(document.activeElement).toBe(b)
        expect(isGrabbed(b)).toBe(true)
    })

    it("skips and keeps unrendered values in place", () => {
        const onReorder = jest.fn()
        const Group = ({ values }: { values: string[] }) => (
            <Reorder.Group values={values} onReorder={onReorder}>
                <Reorder.Item value="a" data-testid="a" />
                <Reorder.Item value="b" data-testid="b" />
            </Reorder.Group>
        )
        const { getByTestId, rerender } = render(
            <Group values={["a", "hidden", "b"]} />
        )

        press(getByTestId("a"), " ")
        press(getByTestId("a"), "ArrowDown")
        // As with drag, "a" and "b" swap slots and "hidden" keeps its own
        expect(onReorder).toHaveBeenLastCalledWith(["b", "hidden", "a"], "a")

        // The app has since moved "hidden" too: cancelling only restores
        // the rendered items, into the slots they now hold
        rerender(<Group values={["hidden", "b", "a"]} />)
        press(getByTestId("a"), "Escape")
        expect(onReorder).toHaveBeenLastCalledWith(["hidden", "a", "b"], "a")
    })

    it("cancelling keeps values added since the grab in their slots", () => {
        const onReorder = jest.fn()
        const Group = ({ values }: { values: string[] }) => (
            <Reorder.Group values={values} onReorder={onReorder}>
                {values.map((value) => (
                    <Reorder.Item
                        key={value}
                        value={value}
                        data-testid={value}
                    />
                ))}
            </Reorder.Group>
        )
        const { getByTestId, rerender } = render(
            <Group values={["a", "b", "c"]} />
        )

        press(getByTestId("b"), " ")
        rerender(<Group values={["new", "a", "b", "c", "end"]} />)
        press(getByTestId("b"), "ArrowDown")
        expect(onReorder).toHaveBeenLastCalledWith(
            ["new", "a", "c", "b", "end"],
            "b"
        )

        rerender(<Group values={["new", "a", "c", "b", "end"]} />)
        press(getByTestId("b"), "Escape")
        expect(onReorder).toHaveBeenLastCalledWith(
            ["new", "a", "b", "c", "end"],
            "b"
        )
    })

    it("applies whileDrag while grabbed", async () => {
        const opacity = motionValue(1)
        const { getByTestId } = render(
            <List
                whileDrag={{ opacity: 0.5 }}
                transition={{ type: false }}
                style={{ opacity }}
                initial={["a"]}
            />
        )
        const a = getByTestId("a")

        press(a, " ")
        await nextFrame()
        expect(opacity.get()).toBe(0.5)

        press(a, " ")
        await nextFrame()
        expect(opacity.get()).toBe(1)

        press(a, " ")
        await nextFrame()
        expect(opacity.get()).toBe(0.5)

        act(() => a.focus())
        act(() => a.blur())
        await nextFrame()
        expect(opacity.get()).toBe(1)
    })

    it("doesn't fire drag callbacks for keyboard grabs", () => {
        const onDragStart = jest.fn()
        const onDragEnd = jest.fn()
        const { getByTestId } = render(
            <List onDragStart={onDragStart} onDragEnd={onDragEnd} />
        )
        const a = getByTestId("a")

        press(a, " ")
        press(a, "ArrowDown")
        press(a, " ")
        expect(onDragStart).not.toBeCalled()
        expect(onDragEnd).not.toBeCalled()
    })
})
