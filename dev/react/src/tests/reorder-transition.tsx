import { Reorder } from "framer-motion"
import { useDeferredValue, useState, useTransition } from "react"

/**
 * Reorder whose order update doesn't commit straight away:
 *
 * ?mode=useTransition  onReorder sets state inside startTransition
 * ?mode=deferred       values come from useDeferredValue
 *
 * Items render slowly so the pending order is still rendering when the
 * next pointermove arrives. Meanwhile an urgent commit happens (the
 * isPending render, or the stale render in front of the deferred value).
 * That commit must not let Reorder call onReorder again with the same order.
 */

const itemHeight = 60
const initialItems = ["0", "1", "2", "3", "4", "5"]
const mode = new URLSearchParams(window.location.search).get("mode")

declare global {
    interface Window {
        reorderCalls: string[]
        dragDone: boolean
    }
}

window.reorderCalls = []
window.dragDone = false

function busy(ms: number) {
    const end = performance.now() + ms
    let now = 0
    while (now < end) now = performance.now()
}

function Label({ value }: { value: string }) {
    busy(10)
    return <>{value}</>
}

function dispatch(type: string, target: EventTarget, x: number, y: number) {
    target.dispatchEvent(
        new PointerEvent(type, {
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: type === "pointerup" ? 0 : 1,
            bubbles: true,
            cancelable: true,
        })
    )
}

/**
 * Drag the first item 3.5 rows down with a pointermove every 16ms.
 */
function drag() {
    const el = document.getElementById("item-0")!
    const { left, top } = el.getBoundingClientRect()
    const x = left + 20
    const startY = top + 20
    const moves = 40
    const distance = itemHeight * 3.5

    dispatch("pointerdown", el, x, startY)
    for (let i = 1; i <= moves; i++) {
        setTimeout(
            () =>
                dispatch(
                    "pointermove",
                    window,
                    x,
                    startY + (distance * i) / moves
                ),
            i * 16
        )
    }
    setTimeout(() => {
        dispatch("pointerup", window, x, startY + distance)
        setTimeout(() => (window.dragDone = true), 500)
    }, moves * 16 + 300)
}

export const App = () => {
    const [items, setItems] = useState(initialItems)
    const [, startTransition] = useTransition()
    const deferredItems = useDeferredValue(items)
    const values = mode === "deferred" ? deferredItems : items

    return (
        <div style={{ padding: 20 }}>
            <button id="drag" onClick={drag}>
                drag
            </button>
            <Reorder.Group
                axis="y"
                values={values}
                onReorder={(next) => {
                    window.reorderCalls.push(next.join(""))
                    mode === "useTransition"
                        ? startTransition(() => setItems(next))
                        : setItems(next)
                }}
                style={{ listStyle: "none", padding: 0, margin: 0, width: 200 }}
            >
                {values.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        id={`item-${item}`}
                        transition={{ duration: 0.2 }}
                        style={{
                            height: itemHeight,
                            background: "#eee",
                            borderBottom: "1px solid #999",
                            boxSizing: "border-box",
                        }}
                    >
                        <Label value={item} />
                    </Reorder.Item>
                ))}
            </Reorder.Group>
        </div>
    )
}
