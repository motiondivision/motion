import { MotionConfig } from "framer-motion"
import { appear } from "framer-motion/appear"
import { motion } from "framer-motion/async"

/**
 * Under a MotionConfig with `appear`, an enter animation runs as CSS.
 */
export const App = () => (
    <MotionConfig
        appear={window.location.search.includes("off") ? undefined : appear}
    >
        <motion.div
            id="box"
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: "tween", ease: "linear", duration: 2 }}
            style={{ width: 100, height: 100, background: "red" }}
        />
    </MotionConfig>
)
