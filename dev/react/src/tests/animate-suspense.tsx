import { lazy } from "react"
import { motion, AnimateSuspense } from "framer-motion"

/**
 * Test for AnimateSuspense component (issue #3173).
 *
 * Uses React.lazy() to create a component that suspends for 500ms.
 * The fallback (motion.div) should animate out when children resolve.
 */

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

export function App() {
    return (
        <AnimateSuspense
            fallback={
                <motion.div
                    id="fallback"
                    key="fallback"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    Loading...
                </motion.div>
            }
        >
            <LazyContent />
        </AnimateSuspense>
    )
}
