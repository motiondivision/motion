import type { Handle } from "remix/component"
import { AnimatePresence, motion } from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const
const w = window as any

function Initial() {
    return () => (
        <AnimatePresence initial={false}>
            <motion.div
                id="no-initial"
                class="box"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={linear}
            />
        </AnimatePresence>
    )
}

function Wait(handle: Handle) {
    let key = "a"
    w.waitSwap = () => {
        key = key === "a" ? "b" : "a"
        handle.update()
    }
    return () => (
        <div id="wait">
            <AnimatePresence
                mode="wait"
                onExitComplete={() => (w.waitExited = (w.waitExited || 0) + 1)}
            >
                <motion.div
                    key={key}
                    id={"wait-" + key}
                    class="box"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "linear" }}
                />
            </AnimatePresence>
        </div>
    )
}

function Pop(handle: Handle) {
    let items = ["a", "b", "c"]
    w.popFirst = () => {
        items = items.slice(1)
        handle.update()
    }
    return () => (
        <ul
            id="pop"
            style={{ position: "relative", listStyle: "none", padding: 0 }}
        >
            <AnimatePresence mode="popLayout">
                {items.map((id) => (
                    <motion.li
                        key={id}
                        id={"pop-" + id}
                        layout
                        exit={{ opacity: 0 }}
                        transition={linear}
                        style={{ height: "40px", background: "#ddd" }}
                    />
                ))}
            </AnimatePresence>
        </ul>
    )
}

const custom = {
    exit: (direction: number) => ({ x: direction * 100 }),
}

function Custom(handle: Handle) {
    let visible = true
    let direction = 1
    w.exitCustom = (next: number) => {
        visible = false
        direction = next
        handle.update()
    }
    return () => (
        <AnimatePresence custom={direction}>
            {visible && (
                <motion.div
                    key="custom"
                    id="custom"
                    class="box"
                    custom={1}
                    variants={custom}
                    exit="exit"
                    transition={linear}
                />
            )}
        </AnimatePresence>
    )
}

export function App() {
    return () => (
        <main>
            <Initial />
            <Wait />
            <Pop />
            <Custom />
        </main>
    )
}
