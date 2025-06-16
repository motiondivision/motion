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
    const [key, setKey] = useState(0)

    return (
        <div
            onClick={() => {
                setKey(key + 1)
            }}
        >
            <AnimatePresence
                initial={false}
                mode="wait"
                onExitComplete={() => console.log("rest")}
            >
                <motion.div
                    key={key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    style={{
                        ...style,
                        background: `hsla(${key * 15}, 100%, 50%, 1)`,
                    }}
                />
            </AnimatePresence>
        </div>
    )
}
