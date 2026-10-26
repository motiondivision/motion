import { AnimatePresence, useMotionValue } from "motion/react"
import { motion } from "motion/react-mini"
import { useState } from "react"

/**
 * The mini `motion` component, which animates with mini animate (WAAPI).
 */
const box = { width: 100, height: 100, background: "red" }
const slow = { duration: 10, ease: "linear" } as const

const list = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const item = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: slow },
}

export const App = () => {
    const [isOpen, setIsOpen] = useState(true)
    const [target, setTarget] = useState(100)
    const x = useMotionValue(0)

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 20,
            }}
        >
            <motion.div
                id="mount"
                style={box}
                initial={{ opacity: 0, x: -100 }}
                animate={{ opacity: 1, x: 0 }}
                transition={slow}
            />
            <motion.div
                id="initial-false"
                style={box}
                initial={false}
                animate={{ opacity: 0.5, x: 50, rotateX: 10 }}
            />
            <motion.div
                id="hover"
                style={box}
                whileHover={{ scale: 1.2, backgroundColor: "#00f" }}
                whileTap={{ scale: 0.8 }}
                transition={slow}
            />
            <motion.ul
                id="list"
                variants={list}
                initial="hidden"
                animate="visible"
            >
                <motion.li id="item-0" variants={item} />
                <motion.li id="item-1" variants={item} />
                <motion.li id="item-2" variants={item} />
            </motion.ul>
            <button id="toggle" onClick={() => setIsOpen(!isOpen)}>
                Toggle
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        id="exit"
                        style={box}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    />
                )}
            </AnimatePresence>
            <button id="retarget" onClick={() => setTarget(target ? 0 : 100)}>
                Retarget
            </button>
            <motion.div
                id="interrupt"
                style={box}
                initial={false}
                animate={{ x: target }}
                transition={slow}
            />
            <button id="set-x" onClick={() => x.set(42)}>
                Set x
            </button>
            <motion.div id="motion-value" style={{ ...box, x }} />
        </div>
    )
}
