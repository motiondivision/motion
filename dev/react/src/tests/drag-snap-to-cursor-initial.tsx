import { motion, useDragControls } from "framer-motion"
import { useState } from "react"

/**
 * An element with initial x/y offsets, dragged via useDragControls with
 * snapToCursor. Every drag start should centre the element under the pointer.
 *
 * With `?rerender=true`, each drag end triggers a React re-render, which
 * re-measures the element's layout.
 */
export const App = () => {
    const controls = useDragControls()
    const [dragCount, setDragCount] = useState(0)
    const rerender =
        new URLSearchParams(window.location.search).get("rerender") === "true"

    return (
        <>
            <div
                id="trigger"
                data-drag-count={dragCount}
                onPointerDown={(event) =>
                    controls.start(event, { snapToCursor: true })
                }
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: 400,
                    height: 400,
                    background: "#eee",
                }}
            />
            <motion.div
                id="box"
                drag
                dragControls={controls}
                dragListener={false}
                dragMomentum={false}
                initial={{ x: 100, y: 40 }}
                onDragEnd={
                    rerender ? () => setDragCount((c) => c + 1) : undefined
                }
                style={{
                    position: "absolute",
                    top: 0,
                    left: 500,
                    width: 100,
                    height: 100,
                    background: "red",
                }}
            />
        </>
    )
}
