import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Reproduction from issue #2538: AnimatePresence's onExitComplete fires
 * before the exiting child has unmounted, so the child's effect cleanups
 * run after it.
 */
const log: string[] = []
;(window as any).__log = log

function Child() {
    useEffect(() => () => void log.push("cleanup"), [])

    return (
        <motion.div
            id="child"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            style={{ width: 100, height: 100, background: "red" }}
        />
    )
}

export const App = () => {
    const [isVisible, setVisible] = useState(true)

    return (
        <>
            <button id="toggle" onClick={() => setVisible(!isVisible)}>
                Toggle
            </button>
            <AnimatePresence
                onExitComplete={() => {
                    log.push(
                        document.getElementById("child")
                            ? "exitComplete:mounted"
                            : "exitComplete:unmounted"
                    )
                }}
            >
                {isVisible && <Child key="child" />}
            </AnimatePresence>
        </>
    )
}
