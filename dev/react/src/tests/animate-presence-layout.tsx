import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

function Component() {
    const [showChild, setShowChild] = useState(true)

    return (
        <motion.div>
            <button id="inner" onClick={() => setShowChild(!showChild)}>
                Toggle
            </button>
            {showChild && <motion.div layout>Hello</motion.div>}
        </motion.div>
    )
}

export const App = () => {
    const [showChild, setShowChild] = useState(true)

    return (
        <>
            <button id="outer" onClick={() => setShowChild(!showChild)}>
                Toggle outer child
            </button>
            <AnimatePresence initial={false}>
                {showChild && (
                    <motion.div
                        id="box"
                        exit={{ opacity: 0 }}
                        style={{ width: 200, height: 200, background: "red" }}
                    >
                        <Component />
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
