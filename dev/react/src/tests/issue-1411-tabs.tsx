import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Issue #1411: tabs where every tab renders its highlight, and only the
 * selected one has the layoutId. When the selection changes, the new
 * highlight animates from the old one, with or without `layout`
 * (?layout=true).
 */
export const App = () => {
    const [selected, setSelected] = useState("a")
    const layout =
        new URLSearchParams(window.location.search).get("layout") === "true"

    return (
        <div style={{ position: "relative" }}>
            {["a", "b"].map((id, i) => (
                <button
                    key={id}
                    id={"select-" + id}
                    onClick={() => setSelected(id)}
                    style={{ position: "absolute", top: 0, left: i * 300 }}
                >
                    {id}
                </button>
            ))}
            {["a", "b"].map((id, i) => (
                <motion.div
                    key={id}
                    id={id}
                    layout={layout || undefined}
                    layoutId={selected === id ? "highlight" : undefined}
                    transition={{ duration: 1, ease: "linear" }}
                    style={{
                        position: "absolute",
                        top: 50,
                        left: i * 300,
                        width: 100,
                        height: 100,
                        background: selected === id ? "red" : "transparent",
                    }}
                />
            ))}
        </div>
    )
}
