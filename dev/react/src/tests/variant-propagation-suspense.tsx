import { motion } from "framer-motion"
import { lazy, Suspense, useLayoutEffect, useState } from "react"

const childVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 2 } },
}

// Simulate a lazy-loaded child — module load takes ~100ms
const LazyChild = lazy(
    () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
            setTimeout(() => {
                resolve({
                    default: () => (
                        <motion.div
                            id="child"
                            variants={childVariants}
                        />
                    ),
                })
            }, 100)
        })
)

const parentVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 2 } },
}

export const App = () => {
    const [show, setShow] = useState(false)

    // Defer to trigger enter animation rather than appear
    useLayoutEffect(() => {
        setShow(true)
    }, [])

    return (
        <div>
            {show && (
                <motion.div
                    id="parent"
                    initial="hidden"
                    animate="visible"
                    variants={parentVariants}
                >
                    <Suspense fallback={<div id="fallback">Loading...</div>}>
                        <LazyChild />
                    </Suspense>
                </motion.div>
            )}
        </div>
    )
}
