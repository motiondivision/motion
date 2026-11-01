import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

/**
 * Issue #4042: gallery items each have layoutId={color} with a nested
 * layoutId={`dot-${color}`} child. The open card shares both layoutIds with
 * the open item. Opening red, then clicking blue while the card is open
 * (switching the card's layoutIds to blue's), then closing, left the card on
 * screen forever: its exit never completed.
 */
const colors = ["red", "blue"]
const transition = { duration: 1 }

export const App = () => {
    const [open, setOpen] = useState<string | null>(null)

    return (
        <div style={{ position: "relative", width: 600, height: 500 }}>
            <div style={{ display: "flex", gap: 20 }}>
                {colors.map((color) => (
                    <motion.div
                        key={color}
                        id={color}
                        layoutId={color}
                        onClick={() => setOpen(color)}
                        transition={transition}
                        style={{ width: 100, height: 100, background: color }}
                    >
                        <motion.div
                            id={`dot-${color}`}
                            layoutId={`dot-${color}`}
                            transition={transition}
                            style={{
                                width: 20,
                                height: 20,
                                background: "#fff",
                            }}
                        />
                    </motion.div>
                ))}
            </div>
            <button id="close" onClick={() => setOpen(null)}>
                Close
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="card"
                        id="card"
                        layoutId={open}
                        transition={transition}
                        style={{
                            position: "absolute",
                            top: 200,
                            left: 200,
                            width: 300,
                            height: 200,
                            background: open,
                        }}
                    >
                        <motion.div
                            layoutId={`dot-${open}`}
                            transition={transition}
                            style={{
                                width: 60,
                                height: 60,
                                background: "#fff",
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
