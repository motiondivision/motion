import { motion } from "framer-motion"
import { useState } from "react"

/**
 * An example of the tween transition type
 */

const style = {
    width: 100,
    height: 100,
    background: "white",
}
export const App = () => {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <motion.div
            initial="none"
            animate={isHovered ? "hover" : "none"}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
        >
            <motion.div
                style={{ opacity: 0.5, ...style }}
                variants={{ hover: { opacity: 1 } }}
                transition={{ duration: 0.001 }}
            />
        </motion.div>
    )
}
