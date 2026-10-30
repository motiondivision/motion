import { motion } from "motion/remix"

const w = window as any

const list = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.5 } },
}

const item = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 1, ease: "linear" } },
    hover: { scale: 1.2, transition: { duration: 0.05 } },
}

export function App() {
    const events: string[] = (w.events = [])
    return () => (
        <motion.ul
            id="list"
            initial="hidden"
            animate="visible"
            whileHover="hover"
            variants={list}
            onAnimationComplete={(definition: string) =>
                events.push("complete " + definition)
            }
            style={{ listStyle: "none", padding: "10px" }}
        >
            <motion.li id="item-0" variants={item}>
                zero
            </motion.li>
            <motion.li id="item-1" variants={item}>
                one
            </motion.li>
        </motion.ul>
    )
}
