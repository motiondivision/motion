import { AnimatePresence, motion, useMotionValue } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const count = useMotionValue(0)
    const [state, setState] = useState(0)

    return (
        <>
            <button
                id="switch"
                onClick={() => {
                    state === 0 ? setState(1) : setState(0)
                }}
            >
                Switch
            </button>
            <div>
                Animation count: <motion.span id="count">{count}</motion.span>
            </div>
            <AnimatePresence initial={false}>
                <motion.div
                    id={state.toString()}
                    className="item"
                    key={state}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onAnimationStart={() => {
                        count.set(count.get() + 1)
                    }}
                >
                    {state}
                </motion.div>
            </AnimatePresence>
        </>
    )
}
