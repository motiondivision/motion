import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [show, setShow] = useState(true)
    const [exitCompleteCount, setExitCompleteCount] = useState(0)

    return (
        <>
            <button id="toggle" onClick={() => setShow(false)}>
                Toggle section
            </button>
            <span id="exit-complete-count">{exitCompleteCount}</span>
            <AnimatePresence
                onExitComplete={() =>
                    setExitCompleteCount((count) => count + 1)
                }
            >
                {show && (
                    <motion.section
                        id="section"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.1 }}
                    >
                        <AnimatePresence propagate>{null}</AnimatePresence>
                    </motion.section>
                )}
            </AnimatePresence>
        </>
    )
}
