import { motion } from "framer-motion"
import { useState } from "react"

const size = { width: 100, height: 100 }
const transition = { duration: 0.1 }

/**
 * Swapping unkeyed siblings reuses each motion component with the other's
 * props, which is what Fast Refresh does when siblings are reordered (#3787).
 */
export const App = () => {
    const [swapped, setSwapped] = useState(false)

    const box = (
        <motion.div
            id="box"
            style={{ ...size, background: "red" }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.8 }}
            transition={transition}
        />
    )
    const sibling = (
        <motion.div
            id="sibling"
            style={{ ...size, background: "blue" }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={transition}
        />
    )

    return (
        <div style={{ padding: 100, display: "flex", gap: 50 }}>
            <button id="swap" onClick={() => setSwapped(true)}>
                Swap
            </button>
            {swapped ? sibling : box}
            {swapped ? box : sibling}
        </div>
    )
}
