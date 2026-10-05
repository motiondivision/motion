import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Issue #1207: a slow, heavily overdamped spring layout animation
 * snaps to its target part-way through.
 */
const transition = {
    type: "spring" as const,
    stiffness: 4,
    damping: 35,
    mass: 0.5,
}

export const App = () => {
    const [moved, setMoved] = useState(false)

    return (
        <div style={{ position: "relative", width: 1200, height: 300 }}>
            <button id="toggle" onClick={() => setMoved(!moved)}>
                Toggle
            </button>
            <motion.div
                id="box"
                layout
                transition={transition}
                style={{
                    position: "absolute",
                    top: 100,
                    left: moved ? 1000 : 0,
                    width: 100,
                    height: 100,
                    background: "blue",
                }}
            />
        </div>
    )
}
