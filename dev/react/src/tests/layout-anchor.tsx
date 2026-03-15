import { motion } from "framer-motion"
import React, { useState } from "react"

/**
 * Test for layoutAnchor prop.
 *
 * Parent uses flexbox centering. When the parent expands via layout animation,
 * a child with layoutAnchor={{ x: 0.5, y: 0.5 }} should stay visually centered
 * rather than drifting toward the top-left.
 *
 * Uses different durations for parent (10s) and child (20s) to desynchronize
 * their animation progress, making drift visible without layoutAnchor.
 */
export function App() {
    const [expanded, setExpanded] = useState(false)

    return (
        <>
            <motion.div
                id="parent"
                layout
                onClick={() => setExpanded(!expanded)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: expanded ? 400 : 200,
                    height: expanded ? 400 : 200,
                    background: "rgba(0,0,0,0.1)",
                    position: "absolute",
                    top: 0,
                    left: 0,
                }}
                transition={{
                    type: "tween",
                    ease: "linear",
                    duration: 10,
                }}
            >
                <motion.div
                    id="child-anchored"
                    layout
                    layoutAnchor={{ x: 0.5, y: 0.5 }}
                    style={{
                        width: 50,
                        height: 50,
                        background: "green",
                    }}
                    transition={{
                        type: "tween",
                        ease: "linear",
                        duration: 20,
                    }}
                />
            </motion.div>

            <motion.div
                id="parent-no-anchor"
                layout
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: expanded ? 400 : 200,
                    height: expanded ? 400 : 200,
                    background: "rgba(0,0,0,0.1)",
                    position: "absolute",
                    top: 0,
                    left: 500,
                }}
                transition={{
                    type: "tween",
                    ease: "linear",
                    duration: 10,
                }}
            >
                <motion.div
                    id="child-no-anchor"
                    layout
                    style={{
                        width: 50,
                        height: 50,
                        background: "red",
                    }}
                    transition={{
                        type: "tween",
                        ease: "linear",
                        duration: 20,
                    }}
                />
            </motion.div>
        </>
    )
}
