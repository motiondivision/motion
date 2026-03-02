import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Test for issue #3356: Layout animations misaligned in scaled parent containers.
 *
 * When a parent has layoutRoot + scale, child layout animations should start
 * from the correct visual position.
 */
export const App = () => {
    const [isB, setIsB] = useState(false)

    return (
        <div>
            <button id="toggle" onClick={() => setIsB(!isB)}>
                Toggle
            </button>
            <motion.div
                id="parent"
                layoutRoot
                style={{
                    scale: 2,
                    position: "absolute",
                    top: 200,
                    left: 200,
                    width: 100,
                    height: 100,
                    background: "#00cc88",
                    display: "flex",
                    justifyContent: isB ? "flex-end" : "flex-start",
                    alignItems: isB ? "flex-end" : "flex-start",
                    transformOrigin: "0 0",
                }}
            >
                <motion.div
                    id="child"
                    layout
                    transition={{ duration: 10 }}
                    style={{
                        width: 50,
                        height: 50,
                        background: "#0077ff",
                    }}
                />
            </motion.div>
        </div>
    )
}
