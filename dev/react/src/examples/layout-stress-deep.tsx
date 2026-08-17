import { motion, MotionConfig } from "framer-motion"
import * as React from "react"
import { useState } from "react"

/**
 * Deep-tree layout stress test: many chains of deeply nested projecting
 * nodes. Exercises the per-node ancestor-path cost of projection
 * calculation (O(nodes × depth) with per-node path walks vs O(nodes)
 * with cumulative path transforms).
 */

const DEPTH = 30
const CHAINS = 40

function Chain({ depth }: { depth: number }) {
    if (depth === 0) return null
    return (
        <motion.div
            layout
            style={{
                backgroundColor: `hsl(${depth * 12}, 50%, 50%)`,
                padding: "2px",
                width: "var(--width)",
                minHeight: "4px",
            }}
        >
            <Chain depth={depth - 1} />
        </motion.div>
    )
}

export const App = () => {
    const [expanded, setExpanded] = useState(false)

    return (
        <MotionConfig transition={{ duration: 2 }}>
            <div
                data-layout
                style={
                    {
                        display: "flex",
                        flexWrap: "wrap",
                        width: "1400px",
                        minHeight: "2000px",
                        alignItems: "flex-start",
                        "--width": expanded ? "30px" : "10px",
                    } as React.CSSProperties
                }
                onClick={() => setExpanded(!expanded)}
            >
                {Array.from({ length: CHAINS }, (_, i) => (
                    <Chain key={i} depth={DEPTH} />
                ))}
            </div>
        </MotionConfig>
    )
}
