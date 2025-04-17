import { motion } from "framer-motion"
import { useMotionValue } from "framer-motion"

/**
 * An example of whileTap propagating through components.
 */

const style = {
    width: 100,
    height: 100,
    background: "white",
}

export const App = () => {
    const scale = useMotionValue(0.5)
    return (
        <motion.div whileTap="pressed">
            <motion.div
                data-testid="child"
                variants={{ pressed: { scale: 1 } }}
                style={{ scale, ...style }}
            />
        </motion.div>
    )
}
