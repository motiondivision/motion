import { motion } from "framer-motion"

/**
 * x, y, scale and rotate should each run as hardware-accelerated
 * animations on the translate, scale and rotate properties.
 */
export const App = () => {
    return (
        <motion.div
            id="box"
            initial={{ x: 0, y: 0, scale: 1, rotate: 0 }}
            animate={{ x: 100, y: 50, scale: 2, rotate: 90 }}
            transition={{ type: "tween", ease: "linear", duration: 10 }}
            style={{
                width: 100,
                height: 100,
                margin: 200,
                background: "red",
            }}
        />
    )
}
