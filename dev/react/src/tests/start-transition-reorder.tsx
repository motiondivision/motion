import { Reorder } from "framer-motion"
import { memo, useDeferredValue, useState, useTransition } from "react"
import {
    SlowList as SlowListBase,
    log,
    mode,
    runFrameScript,
    update,
    useCommitLog,
} from "./start-transition-helpers"

/**
 * Reorder with onReorder wrapped in startTransition / useTransition, or with
 * `values` fed from useDeferredValue. The drag is scripted with synthetic
 * pointer events every 16ms so each mode gets the same input.
 *
 * ?mode=sync|transition|useTransition|deferred
 */

const SlowList = memo(SlowListBase)
const itemHeight = 60
const initialItems = ["0", "1", "2", "3", "4", "5"]

declare global {
    interface Window {
        __pointer: { t: number; y: number }[]
    }
}

function pointer(type: string, target: EventTarget, x: number, y: number) {
    if (type === "pointermove") {
        window.__pointer.push({ t: performance.now(), y })
    }
    log(type, {
        y,
        // Pointer offset from the item's top, measured as the drag starts
        grab:
            type === "pointerdown"
                ? y - (target as Element).getBoundingClientRect().top
                : undefined,
    })
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
 * One action per frame: two idle frames (so React 19 StrictMode's post-paint
 * ref remount can't cancel the gesture), pointerdown, 40 pointermoves, a
 * ~300ms hold, pointerup.
 */
function dragScript(): Array<() => void> {
    const el = document.getElementById("item-0")!
    const { left, top } = el.getBoundingClientRect()
    const x = left + 20
    const startY = top + 20
    const noop = () => {}
    const actions: Array<() => void> = [
        noop,
        noop,
        () => pointer("pointerdown", el, x, startY),
    ]
    const moves = 40
    const distance = itemHeight * 3.5
    for (let i = 1; i <= moves; i++) {
        const y = startY + (distance * i) / moves
        actions.push(() => pointer("pointermove", window, x, y))
    }
    for (let i = 0; i < 18; i++) actions.push(noop)
    const endY = startY + distance
    actions.push(() => pointer("pointerup", window, x, endY))
    return actions
}

export const App = () => {
    const [items, setItems] = useState(initialItems)
    const [, start] = useTransition()
    const deferredItems = useDeferredValue(items)
    const values = mode === "deferred" ? deferredItems : items
    useCommitLog("items", values.join(""))

    return (
        <div style={{ padding: 20 }}>
            <button
                id="run"
                onClick={() => {
                    window.__pointer = []
                    runFrameScript(dragScript(), 1500)
                }}
            >
                run
            </button>
            <Reorder.Group
                axis="y"
                values={values}
                onReorder={(next) => {
                    log("onReorder", next.join(""))
                    update(() => setItems(next), start)
                }}
                style={{ listStyle: "none", padding: 0, margin: 0, width: 200 }}
            >
                {values.map((item) => (
                    <Reorder.Item
                        key={item}
                        value={item}
                        id={`item-${item}`}
                        data-track={`item-${item}`}
                        transition={{ duration: 0.2 }}
                        style={{
                            height: itemHeight,
                            background: "#eee",
                            borderBottom: "1px solid #999",
                            boxSizing: "border-box",
                        }}
                    >
                        {item}
                    </Reorder.Item>
                ))}
            </Reorder.Group>
            <SlowList tick={values.join("")} />
        </div>
    )
}
