import { motion } from "motion/react"

export const Button = ({ children }: { children: string }) => (
    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        {children}
    </motion.button>
)
