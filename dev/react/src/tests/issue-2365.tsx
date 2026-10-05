import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Issue #2365: `motion.svg` style prop changes don't get applied.
 *
 * Clicking each square should turn it from red to blue. The plain `svg` and
 * `motion.div` cases work; the reported bug is that `motion.svg` keeps the
 * style it was first rendered with.
 */
export const App = () => {
    const [color, setColor] = useState("red")
    const toggle = () => setColor("blue")

    return (
        <div style={{ display: "flex", gap: 20 }}>
            <svg
                id="plain-svg"
                width={100}
                height={100}
                onClick={toggle}
                style={{ backgroundColor: color }}
            />
            <motion.svg
                id="motion-svg"
                width={100}
                height={100}
                onClick={toggle}
                style={{ backgroundColor: color }}
            />
            <motion.svg
                id="motion-svg-fill"
                width={100}
                height={100}
                onClick={toggle}
                style={{ fill: color }}
            >
                <rect id="motion-svg-fill-rect" width={100} height={100} />
            </motion.svg>
            <motion.div
                id="motion-div"
                onClick={toggle}
                style={{ width: 100, height: 100, backgroundColor: color }}
            />
        </div>
    )
}
