import { motion } from "framer-motion"
import { Suspense, useState } from "react"

/**
 * The suspending sibling owns the state, so when the boundary reveals the
 * motion.div again it bails out of rendering - the same thing happens when
 * the React Compiler memoizes JSX (issue #3832).
 */
const Suspender = () => {
    const [promise, setPromise] = useState<Promise<void> | null>(null)

    if (promise) throw promise

    return (
        <button
            id="suspend"
            onClick={() => {
                const pending = new Promise<void>((resolve) =>
                    setTimeout(() => {
                        setPromise(null)
                        resolve()
                    }, 500)
                )
                setPromise(pending)
            }}
        >
            Suspend
        </button>
    )
}

export const App = () => (
    <Suspense fallback={<div id="fallback">Suspended</div>}>
        <Suspender />
        <motion.div
            id="box"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{ width: 100, height: 100, background: "blue" }}
        />
    </Suspense>
)
