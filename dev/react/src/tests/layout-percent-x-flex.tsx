import { useState } from "react"
import { motion } from "framer-motion"

export const App = () => {
    const [items, setItems] = useState<number[]>([])

    const addItem = () => setItems((prev) => [...prev, prev.length])

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
                {items.map((id) => (
                    <motion.div
                        key={id}
                        layout
                        id={`item-${id}`}
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        transition={{
                            duration: 0.1,
                            layout: { duration: 10 },
                        }}
                        style={{
                            width: 100,
                            height: 100,
                            background: "red",
                            flexShrink: 0,
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
