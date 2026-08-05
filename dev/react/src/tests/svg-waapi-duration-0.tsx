"use client"

import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Reproduction for #3779: opacity (and transform) must render as CSS styles
 * on SVG elements so WAAPI onfinish and duration: 0 updates share a target.
 */
export const App = () => {
    const [visible, setVisible] = useState(true)

    return (
        <section style={{ padding: 100 }}>
            <svg width="400" height="200">
                <motion.foreignObject
                    id="opacity-target"
                    width="180"
                    height="180"
                    initial={false}
                    animate={{ opacity: visible ? 1 : 0 }}
                    transition={{
                        duration: visible ? 0 : 0.2,
                    }}
                >
                    <div>
                        <button
                            id="opacity-toggle"
                            onClick={() => setVisible(!visible)}
                        >
                            Toggle opacity
                        </button>
                    </div>
                </motion.foreignObject>
                <motion.rect
                    id="transform-target"
                    x={220}
                    y={40}
                    width={100}
                    height={100}
                    fill="#0f0"
                    initial={false}
                    animate={{
                        transform: visible
                            ? "translateX(0px)"
                            : "translateX(50px)",
                    }}
                    transition={{
                        duration: visible ? 0 : 0.2,
                    }}
                />
            </svg>
            <button
                id="transform-toggle"
                onClick={() => setVisible(!visible)}
            >
                Toggle transform
            </button>
        </section>
    )
}
