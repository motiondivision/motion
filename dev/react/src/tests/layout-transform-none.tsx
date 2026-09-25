import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Each box's transform finishes as "none", which projection must treat
 * as the default rather than writing an invalid transform.
 */
const boxes = [
    { id: "rotate", animate: { rotate: "none" } },
    { id: "x", animate: { x: "none" } },
    { id: "scale", animate: { scale: "none" } },
]

export const App = () => {
    const [moved, setMoved] = useState(false)

    return (
        <>
            <button id="move" onClick={() => setMoved(true)}>
                move
            </button>
            {boxes.map(({ id, animate }, i) => (
                <motion.div
                    key={id}
                    id={id}
                    layout
                    animate={animate}
                    transition={{
                        duration: 0.1,
                        layout: { duration: 10, ease: "linear" },
                    }}
                    style={{
                        position: "absolute",
                        top: 50 + i * 120,
                        left: moved ? 400 : 0,
                        width: 100,
                        height: 100,
                        background: "red",
                    }}
                />
            ))}
        </>
    )
}
