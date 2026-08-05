"use client"

import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Reproduction for #3779: after a WAAPI-driven SVG opacity animation,
 * a duration: 0 update only writes the SVG attribute and leaves the
 * WAAPI-committed inline style in place. CSS wins over the attribute,
 * so the element stays invisible.
 */
export const App = () => {
    const [visible, setVisible] = useState(true)

    return (
        <section style={{ padding: 100 }}>
            <svg width="200" height="200">
                <motion.foreignObject
                    id="target"
                    width="200"
                    height="200"
                    initial={false}
                    animate={{ opacity: visible ? 1 : 0 }}
                    transition={{
                        // Fade out with WAAPI; fade back in instantly
                        duration: visible ? 0 : 0.2,
                    }}
                >
                    <div>
                        <button
                            id="toggle"
                            onClick={() => setVisible(!visible)}
                        >
                            Toggle
                        </button>
                    </div>
                </motion.foreignObject>
            </svg>
        </section>
    )
}
