/**
 * This test is for a bug in Chrome 93, the bounding box is incorrect while the
 * child of a transformed parent has a scale applied.
 * https://bugs.chromium.org/p/chromium/issues/detail?id=1247858&q=getBoundingClientRect&can=1
 * The issue is fixed in Version 94.0.4606.61 (Official Build) (x86_64).
 */
import { motion } from "framer-motion"
import { useState } from "react";

export const App = () => {
    const [hover, setHover] = useState(false)

    return (
        <motion.div style={{ width: 400, height: 400, position: "relative" }}>
            <motion.div
                id="parent"
                layout
                style={{
                    position: "absolute",
                    width: 100,
                    height: 100,
                    left: "50%",
                    top: "50%",
                    transform: "translateY(-50%)",
                }}
            >
                <motion.div
                    id="mid"
                    layout
                    style={{
                        width: "100%",
                        height: "100%",
                        position: "relative",
                    }}
                >
                    <motion.div
                        id="box"
                        data-testid="box"
                        layout
                        style={hover ? b : a}
                        onClick={() => setHover((h) => (h ? false : true))}
                        transition={{ duration: 10, ease: () => 0.5 }}
                    />
                </motion.div>
            </motion.div>
        </motion.div>
    )
}

const box = {
    position: "absolute",

    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    background: "red",
}

const a = {
    ...box,
}

const b = {
    ...box,
    left: 50,
}
