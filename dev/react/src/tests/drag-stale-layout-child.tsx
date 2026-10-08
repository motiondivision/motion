import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A draggable element without `layout` re-renders on drag start. Content
 * above it may have moved it since it was last measured (here, #spacer is
 * resized by the test via the DOM). Its `layout` child hasn't moved
 * relative to it, so it shouldn't animate.
 */
export const App = () => {
    const [dragging, setDragging] = useState(false)
    return (
        <>
            <div id="spacer" style={{ height: 50 }} />
            <motion.div
                id="parent"
                drag
                dragMomentum={false}
                onDragStart={() => setDragging(true)}
                style={{
                    width: 300,
                    height: 200,
                    marginLeft: 50,
                    background: dragging ? "#ddd" : "#eee",
                }}
            >
                <motion.div
                    id="child"
                    layout
                    transition={{ duration: 10, ease: "linear" }}
                    style={{ width: 50, height: 50, background: "red" }}
                />
            </motion.div>
        </>
    )
}
