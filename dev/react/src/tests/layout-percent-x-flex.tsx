import { useState } from "react"
import { motion } from "framer-motion"

/**
 * Regression test for https://github.com/motiondivision/motion/issues/3401
 *
 * Matches the reporter's sandbox pattern: only the most-recently-added item
 * has initial/animate props. When the next item is added, shouldAnimate flips
 * false for the previous item — its x animation stops and latestValues.x
 * stays at "100%" indefinitely. The layout update then fires with an
 * unresolved percentage, triggering the teleport bug.
 */

interface Item {
    id: number
    isAdded: boolean
}

export const App = () => {
    const [items, setItems] = useState<Item[]>([
        { id: 0, isAdded: false },
        { id: 1, isAdded: false },
    ])

    const addItem = () =>
        setItems((prev) => [...prev, { id: prev.length, isAdded: true }])

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: 20,
            }}
        >
            <button id="add" onClick={addItem}>
                Add
            </button>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                {items.map((item, i) => {
                    const shouldAnimate =
                        i === items.length - 1 && item.isAdded

                    return (
                        <motion.div
                            key={item.id}
                            layout
                            id={`item-${item.id}`}
                            initial={
                                shouldAnimate ? { x: "100%" } : undefined
                            }
                            animate={shouldAnimate ? { x: 0 } : undefined}
                            transition={{ duration: 10 }}
                            style={{
                                width: 100,
                                height: 100,
                                background: "red",
                                flexShrink: 0,
                            }}
                        />
                    )
                })}
            </div>
        </div>
    )
}
