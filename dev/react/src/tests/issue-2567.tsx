import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Reproduction from issue #2567 (rebuilt from the description): items
 * mounted with layout={false} don't start layout animating after the
 * layout prop changes to true.
 */
export const App = () => {
    const [items, setItems] = useState([0, 1])
    const [layout, setLayout] = useState(false)

    return (
        <>
            <button id="toggle" onClick={() => setLayout(!layout)}>
                Toggle
            </button>
            <button
                id="add"
                onClick={() => setItems([items.length, ...items])}
            >
                Add
            </button>
            <div id="layout-state">{String(layout)}</div>
            {items.map((item) => (
                <motion.div
                    key={item}
                    id={`item-${item}`}
                    layout={layout}
                    transition={{ duration: 10, ease: "linear" }}
                    style={{
                        width: 100,
                        height: 100,
                        background: "red",
                        marginBottom: 10,
                    }}
                />
            ))}
        </>
    )
}
