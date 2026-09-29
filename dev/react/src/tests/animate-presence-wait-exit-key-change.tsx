import { AnimatePresence, motion } from "framer-motion"
import { useRef, useState } from "react"

/**
 * mode="wait" where the key changes again at the moment the exiting child
 * finishes its exit, with no transitions involved.
 */
export const App = () => {
    const [count, setCount] = useState(0)
    const armed = useRef(false)

    return (
        <div>
            <button
                id="next"
                onClick={() => {
                    armed.current = true
                    setCount(1)
                }}
            >
                next
            </button>
            <p id="state">{count}</p>
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={count}
                    id={`child-${count}`}
                    className="child"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    onAnimationComplete={() => {
                        if (count === 0 && armed.current) {
                            armed.current = false
                            setCount(2)
                        }
                    }}
                >
                    {count}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
