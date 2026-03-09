import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Reproduction for #3356: Layout animations misaligned in scaled parent containers.
 *
 * A parent motion.div has layoutRoot and style={{ scale: 2 }}.
 * A child motion.div with layout toggles its CSS top position.
 * The layout animation should smoothly interpolate between the two visual positions.
 *
 * With the bug, the projection system doesn't account for the parent's scale
 * when computing layout animation deltas, causing misaligned animations.
 * Using originX/originY as motion values (not CSS transformOrigin) ensures
 * removeTransform uses the correct origin.
 */
export const App = () => {
    const [toggled, setToggled] = useState(false)

    return (
        <div style={{ padding: 0, margin: 0 }}>
            <motion.div
                layoutRoot
                style={{
                    scale: 2,
                    originX: 0,
                    originY: 0,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 200,
                    height: 200,
                }}
            >
                <motion.div
                    id="child"
                    layout
                    style={{
                        position: "absolute",
                        top: toggled ? 50 : 0,
                        left: 0,
                        width: 50,
                        height: 50,
                        background: "red",
                    }}
                    transition={{ duration: 10, ease: () => 0.5 }}
                />
            </motion.div>
            <div
                id="toggle"
                onClick={() => setToggled((s) => !s)}
                style={{
                    position: "absolute",
                    top: 500,
                    left: 0,
                    width: 100,
                    height: 50,
                    background: "blue",
                    cursor: "pointer",
                    zIndex: 10,
                }}
            >
                Toggle
            </div>
        </div>
    )
}
