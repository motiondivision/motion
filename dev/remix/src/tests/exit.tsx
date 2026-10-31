import type { Handle } from "remix/component"
import { AnimatePresence, motion } from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const
const w = window as any

function Exit(handle: Handle) {
    let visible = true
    w.toggleExit = () => {
        visible = !visible
        handle.update()
    }
    return () => (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="exit"
                    id="exit"
                    class="box"
                    initial={false}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={linear}
                />
            )}
        </AnimatePresence>
    )
}

function NestedExit(handle: Handle) {
    let visible = true
    w.toggleNested = () => {
        visible = !visible
        handle.update()
    }
    return () => (
        <div>
            {visible && (
                <motion.section
                    key="outer"
                    id="outer"
                    exit={{ opacity: 0.5 }}
                    transition={{ duration: 0.2 }}
                >
                    <motion.p id="inner" exit={{ x: 100 }} transition={linear}>
                        inner
                    </motion.p>
                </motion.section>
            )}
        </div>
    )
}

export function App() {
    return () => (
        <main>
            <Exit />
            <NestedExit />
        </main>
    )
}
