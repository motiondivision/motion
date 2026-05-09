import { useState } from "react"
import { motion } from "framer-motion"

/**
 * Test for #3101 — clipPath animation should interpolate cleanly between
 * two `inset()` values that mix unitless `0` and `0px` lengths.
 */
export const App = () => {
    const [collapse, setCollapse] = useState(false)

    return (
        <section
            id="trigger"
            onClick={() => setCollapse(!collapse)}
            style={{ width: 500, height: 200 }}
        >
            <motion.div
                id="box"
                style={{
                    width: 500,
                    height: 200,
                    background: "red",
                }}
                animate={{
                    clipPath: collapse
                        ? "inset(0 120px 0 120px)"
                        : "inset(0 0px 0 0px)",
                }}
                transition={{ duration: 1, ease: "linear" }}
            />
        </section>
    )
}
