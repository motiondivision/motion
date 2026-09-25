import { motion } from "framer-motion"
import { useState } from "react"

/**
 * Browsers flush a pending (coalesced) pointermove right before pointerup,
 * so the final move and the release often arrive within the same frame.
 * The element should come to rest at the release point, matching the
 * offset reported to onDragEnd.
 */
export const App = () => {
    const [offset, setOffset] = useState("")

    return (
        <div style={{ padding: 100 }}>
            <motion.div
                data-testid="draggable"
                drag
                dragElastic={0}
                dragMomentum={false}
                onDragEnd={(_, info) =>
                    setOffset(`${info.offset.x},${info.offset.y}`)
                }
                style={{ width: 50, height: 50, background: "red" }}
            />
            <div id="drag-end-offset">{offset}</div>
        </div>
    )
}
