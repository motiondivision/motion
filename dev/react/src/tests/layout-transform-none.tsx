import { motion } from "framer-motion"
import { useState } from "react"

/**
 * rotate finishes as "none", which the projection transform must treat
 * as the default rather than writing an invalid rotate(nonedeg).
 */
export const App = () => {
    const [moved, setMoved] = useState(false)

    return (
        <motion.div
            id="box"
            layout
            animate={{ rotate: "none" }}
            transition={{
                duration: 0.1,
                layout: { duration: 10, ease: "linear" },
            }}
            onClick={() => setMoved(true)}
            style={{
                position: "absolute",
                top: 0,
                left: moved ? 400 : 0,
                width: 100,
                height: 100,
                background: "red",
            }}
        />
    )
}
