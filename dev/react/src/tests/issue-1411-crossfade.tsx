import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Issue #1411: with layoutCrossfade={false}, an element whose layoutId moves
 * to a sibling must stay visible. The new lead hides the previous lead, as
 * it would usually be unmounting.
 */
export const App = () => {
    const [selected, setSelected] = useState("a")

    return (
        <div style={{ position: "relative" }}>
            <button id="select-a" onClick={() => setSelected("a")}>
                a
            </button>
            <button id="select-b" onClick={() => setSelected("b")}>
                b
            </button>
            {["a", "b"].map((id, i) => (
                <motion.div
                    key={id}
                    id={id}
                    layout
                    layoutId={selected === id ? "selected" : undefined}
                    layoutCrossfade={false}
                    transition={{ duration: 0.1 }}
                    style={{
                        position: "absolute",
                        top: 50,
                        left: i * 300,
                        width: 100,
                        height: 100,
                        background: "red",
                    }}
                />
            ))}
        </div>
    )
}
