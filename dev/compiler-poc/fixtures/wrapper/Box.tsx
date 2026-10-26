import { motion } from "motion/react"
import type { ComponentProps } from "react"

export const Box = (props: ComponentProps<typeof motion.div>) => (
    <motion.div {...props} />
)
