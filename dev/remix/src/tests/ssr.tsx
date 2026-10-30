import { motion } from "motion/remix"

const linear = { duration: 1, ease: "linear" } as const
const item = { hidden: { opacity: 0 }, visible: { opacity: 1 } }

export function App() {
    return () => (
        <main>
            <motion.div
                id="box"
                class="box"
                initial={{ opacity: 0, x: -100, scale: 0.5 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={linear}
            />
            <motion.ul id="list" initial="hidden" animate="visible">
                <motion.li id="item" variants={item} transition={linear}>
                    a
                </motion.li>
            </motion.ul>
            <svg width="100" height="100">
                <motion.path
                    id="path"
                    d="M 0 50 L 100 50"
                    stroke="black"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={linear}
                />
            </svg>
        </main>
    )
}
