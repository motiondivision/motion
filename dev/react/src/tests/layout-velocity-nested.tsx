import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A small child inside a big parent. Both animate layout with the default
 * transition. The child must keep its place in the parent while the
 * animation is interrupted.
 */
export const App = () => {
    const [isBig, setIsBig] = useState(false)
    const size = isBig ? 600 : 300

    return (
        <motion.div
            id="parent"
            layout
            onClick={() => setIsBig(!isBig)}
            style={{
                position: "absolute",
                top: 0,
                left: isBig ? 200 : 0,
                width: size,
                height: size,
                background: "red",
            }}
        >
            <motion.div
                id="child"
                layout
                style={{
                    position: "absolute",
                    top: 20,
                    left: 20,
                    width: 40,
                    height: 40,
                    background: "blue",
                }}
            />
        </motion.div>
    )
}
