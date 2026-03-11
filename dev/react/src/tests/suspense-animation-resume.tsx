import { Suspense, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

/**
 * Test component that verifies motion values are reset to initial values
 * after a Suspense unmount/remount cycle (issue #2269).
 *
 * Timeline:
 *   0ms   - Animation starts (opacity 0 → 1, scale 0.5 → 2)
 *   400ms - Component suspends mid-animation
 *   900ms - Component resumes, values should reset to initial
 */
const SuspendingChild = () => {
    const [promise, setPromise] = useState<null | Promise<void>>(null)
    const hasSuspended = useRef(false)

    useEffect(() => {
        if (hasSuspended.current) return

        const suspendTimeout = setTimeout(() => {
            hasSuspended.current = true
            setPromise(
                new Promise((resolve) => {
                    setTimeout(() => {
                        resolve()
                        setPromise(null)
                    }, 500)
                })
            )
        }, 400)

        return () => {
            clearTimeout(suspendTimeout)
        }
    }, [])

    if (promise) {
        throw promise
    }

    return (
        <motion.div
            id="target"
            style={{
                width: 100,
                height: 100,
                background: "blue",
            }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 2 }}
            transition={{ duration: 10 }}
        />
    )
}

export function App() {
    return (
        <Suspense fallback={<div id="fallback">Suspended</div>}>
            <SuspendingChild />
        </Suspense>
    )
}
