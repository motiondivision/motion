import { Reorder } from "framer-motion"
import { memo, useDeferredValue, useState, useTransition } from "react"
import {
    SlowList as SlowListBase,
    log,
    mode,
    runScript,
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
    log(type, { y })
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

function dragScript(): Array<[number, () => void]> {
    const el = document.getElementById("item-0")!
    const { left, top } = el.getBoundingClientRect()
    const x = left + 20
    const startY = top + 20
    const steps: Array<[number, () => void]> = [
        [100, () => pointer("pointerdown", el, x, startY)],
    ]
    const moves = 40
    const distance = itemHeight * 3.5
    for (let i = 1; i <= moves; i++) {
        const y = startY + (distance * i) / moves
        steps.push([100 + i * 16, () => pointer("pointermove", window, x, y)])
    }
    const endY = startY + distance
    steps.push([
        100 + moves * 16 + 300,
        () => pointer("pointerup", window, x, endY),
    ])
    return steps
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
                    runScript(dragScript(), 1500)
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
