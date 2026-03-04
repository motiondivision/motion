import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

/**
 * Reproduction for #3260: popLayout rounds sub-pixel dimensions to integers.
 *
 * The container is 400.4px wide. The child stretches to that width.
 * When the child exits, popLayout should preserve the sub-pixel width.
 */
export const App = () => {
    const [show, setShow] = useState(true)

    return (
        <div
            id="container"
            style={{ width: 400.4, position: "relative" }}
        >
            <AnimatePresence mode="popLayout">
                {show && (
                    <motion.div
                        key="child"
                        id="child"
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: 10 } }}
                    >
                        Content
                    </motion.div>
                )}
            </AnimatePresence>
            <button id="toggle" onClick={() => setShow(false)}>
                Toggle
            </button>
        </div>
    )
}
