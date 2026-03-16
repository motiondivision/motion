import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

export const App = () => {
    const [open, setOpen] = useState(false)

    return (
        <div>
            <button
                id="toggle"
                onClick={() => setOpen((prev) => !prev)}
            >
                Toggle
            </button>
            <AnimatePresence>
                {open && (
                    <div id="container" className="fixed inset-0">
                        <motion.div
                            id="drawer"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{
                                type: "tween",
                                duration: 0.3,
                            }}
                        >
                            Drawer Content
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}
