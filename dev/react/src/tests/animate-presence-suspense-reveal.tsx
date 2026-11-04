import { AnimatePresence, motion } from "framer-motion"
import { Suspense, useState } from "react"

/**
 * #4049: Selecting an uncached item suspends the boundary, and the render
 * that reveals it again removes the action, which must still exit.
 */
const cache = new Map<string, { hasAction: boolean }>([
    ["a", { hasAction: true }],
])
const pending = new Map<string, Promise<void>>()

const read = (id: string) => {
    const item = cache.get(id)
    if (item) return item

    if (!pending.has(id)) {
        pending.set(
            id,
            new Promise<void>((resolve) =>
                setTimeout(() => {
                    cache.set(id, { hasAction: false })
                    resolve()
                }, 300)
            )
        )
    }

    throw pending.get(id)
}

const Details = ({ id }: { id: string }) => {
    const { hasAction } = read(id)

    return (
        <>
            <p id={"item-" + id}>Item {id}</p>
            <AnimatePresence>
                {hasAction && (
                    <motion.button
                        key="action"
                        id="action"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        Action for {id}
                    </motion.button>
                )}
            </AnimatePresence>
        </>
    )
}

export const App = () => {
    const [id, setId] = useState("a")

    return (
        <>
            <button id="select-c" onClick={() => setId("c")}>
                Select C
            </button>
            <Suspense fallback={<p id="loading">Loading…</p>}>
                <Details id={id} />
            </Suspense>
        </>
    )
}
