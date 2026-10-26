import { AnimatePresence, useMotionValue } from "motion/react"
import { motion } from "motion/react-mini"
import { useState } from "react"

/**
 * Inheritance, presence and motion value cases for the mini `motion`
 * component.
 */
const box = { width: 50, height: 50, background: "red" }

const slides = {
    exit: (direction: number) => ({
        x: direction * 100,
        transition: { duration: 1 },
    }),
}

const parentVariants = {
    a: { transition: { delayChildren: 2 } },
    b: { transition: { delayChildren: 2 } },
}

export const App = () => {
    const [isShown, setIsShown] = useState(true)
    const [direction, setDirection] = useState(1)
    const [isSlideShown, setIsSlideShown] = useState(true)
    const [count, setCount] = useState(0)
    const x = useMotionValue(0)

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 10,
            }}
        >
            <motion.div
                id="object-parent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.1 }}
            >
                <motion.div id="object-child" style={box} />
            </motion.div>

            <AnimatePresence initial={false}>
                <motion.div
                    id="presence-initial"
                    style={box}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 10 }}
                />
            </AnimatePresence>

            <button id="toggle" onClick={() => setIsShown(!isShown)}>
                Toggle
            </button>
            <AnimatePresence>
                {isShown && (
                    <motion.div
                        id="reenter"
                        style={box}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1, ease: "linear" }}
                    />
                )}
            </AnimatePresence>

            <button id="toggle-slide" onClick={() => setIsSlideShown(false)}>
                Remove slide
            </button>
            <button id="direction" onClick={() => setDirection(-direction)}>
                Direction
            </button>
            <AnimatePresence custom={direction}>
                {isSlideShown && (
                    <motion.div
                        id="slide"
                        style={box}
                        variants={slides}
                        exit="exit"
                    />
                )}
            </AnimatePresence>

            <button id="count" onClick={() => setCount(count + 1)}>
                Count
            </button>
            <motion.div
                id="own-target-parent"
                variants={parentVariants}
                animate={count % 2 ? "a" : "b"}
            >
                <motion.div
                    id="own-target-child"
                    style={box}
                    animate={{ x: count * 10 }}
                    transition={{ duration: 10 }}
                />
            </motion.div>

            <button id="set-x" onClick={() => x.set(42)}>
                Set x
            </button>
            <motion.div
                id="motion-value-and-animate"
                style={{ ...box, x }}
                initial={false}
                animate={{ y: 50 }}
            />
        </div>
    )
}
