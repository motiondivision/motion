import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

/**
 * An example of a single-child AnimatePresence animation
 */

const style = {
    width: 100,
    height: 100,
    background: "red",
    opacity: 1,
}

export const App = () => {
    const [isVisible, setVisible] = useState(true)

    return (
        <div
            onClick={() => setVisible(!isVisible)}
            style={{ width: 1000, height: 1000, background: "green" }}
        >
            <AnimatePresence
                initial={false}
                onExitComplete={() => console.log("rest")}
            >
                {isVisible && (
                    <motion.div
                        key="a"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        style={style}
                    >
                        <AnimatePresence propagate initial={false}>
                            <motion.div
                                key="b"
                                exit={{ x: 100 }}
                                transition={{ duration: 1 }}
                                style={{
                                    width: 50,
                                    height: 50,
                                    background: "blue",
                                }}
                            >
                                Hello
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
