import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Reproduction for #3254: layout animation breaks when nested
 * in a parent motion.div with percentage x/y values.
 */
export const App = () => {
    const [selected, setSelected] = useState(0)

    return (
        <motion.div
            style={{
                x: "25%",
                y: "25%",
                width: 300,
            }}
        >
            <div style={{ display: "flex", height: 32 }}>
                {[0, 1, 2].map((index) => (
                    <div
                        key={index}
                        id={`tab-${index}`}
                        onClick={() => setSelected(index)}
                        style={{
                            flex: 1,
                            position: "relative",
                            cursor: "pointer",
                        }}
                    >
                        {selected === index ? (
                            <motion.div
                                layoutId="indicator"
                                id="indicator"
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    height: 4,
                                    background: "red",
                                }}
                                transition={{ duration: 10, ease: () => 0.5 }}
                            />
                        ) : null}
                    </div>
                ))}
            </div>
        </motion.div>
    )
}
