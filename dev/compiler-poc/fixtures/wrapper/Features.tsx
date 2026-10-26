import { motion } from "motion/react"

const list = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const item = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }

export const Features = ({ items }: { items: string[] }) => (
    <motion.ul
        variants={list}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
    >
        {items.map((text) => (
            <motion.li key={text} variants={item}>
                {text}
            </motion.li>
        ))}
    </motion.ul>
)
