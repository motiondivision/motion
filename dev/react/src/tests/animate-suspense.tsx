import { lazy, useEffect } from "react"
import { motion, AnimateSuspense } from "framer-motion"

/**
 * Test for AnimateSuspense component (issue #3173).
 *
 * Two modes via ?mode=:
 *   "suspend" (default): React.lazy children that suspend for 500ms, then resolve.
 *   "sync":              Children that never suspend — fallback must never render.
 */

const params = new URLSearchParams(window.location.search)
const mode = params.get("mode") || "suspend"

const LazyContent = lazy(
    () =>
        new Promise<{ default: React.ComponentType }>((resolve) => {
            setTimeout(() => {
                resolve({
                    default: () => (
                        <motion.div
                            id="content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            Loaded Content
                        </motion.div>
                    ),
                })
            }, 500)
        })
)

const SyncContent = () => (
    <motion.div
        id="content"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
    >
        Sync Content
    </motion.div>
)

function Fallback() {
    useEffect(() => {
        const w = window as unknown as { __fallbackMountCount?: number }
        w.__fallbackMountCount = (w.__fallbackMountCount || 0) + 1
    }, [])

    return (
        <motion.div
            id="fallback"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
        >
            Loading...
        </motion.div>
    )
}

;(window as unknown as { __fallbackMountCount: number }).__fallbackMountCount = 0

export function App() {
    const Content = mode === "sync" ? SyncContent : LazyContent

    return (
        <AnimateSuspense fallback={<Fallback />}>
            <Content />
        </AnimateSuspense>
    )
}
