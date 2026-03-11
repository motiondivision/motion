import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [show, setShow] = useState(true)
    const params = new URLSearchParams(window.location.search)
    const withPadding = params.get("padding") === "true"

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
                        style={
                            withPadding
                                ? {
                                      width: 200,
                                      padding: 20,
                                      borderWidth: 5,
                                      borderStyle: "solid",
                                      borderColor: "red",
                                      boxSizing: "content-box" as const,
                                  }
                                : undefined
                        }
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
