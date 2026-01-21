import { useScroll, useMotionValueEvent, motion } from "framer-motion"
import * as React from "react"
import { useState, useRef } from "react"

/**
 * Test for issue #2748
 * When elements move in the DOM (e.g., after filtering), useScroll with a target
 * should still report accurate progress based on the target's new position.
 *
 * The bug: After DOM reordering, useScroll doesn't recognize the target's
 * position change and reports incorrect progress.
 */
export const App = () => {
    const [items, setItems] = useState([1, 2, 3, 4, 5])
    const targetRef = useRef<HTMLDivElement>(null)
    const [progress, setProgress] = useState(0)
    const [reordered, setReordered] = useState(false)

    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"],
    })

    useMotionValueEvent(scrollYProgress, "change", (latest) => {
        setProgress(latest)
    })

    const handleReorder = () => {
        // Move item 3 (the tracked target) to the top of the list
        setItems([3, 1, 2, 4, 5])
        setReordered(true)
        // NO scroll workaround - testing if the library updates automatically
    }

    const handleScrollDown = () => {
        window.scrollTo({ top: 200 })
    }

    return (
        <>
            <div style={{ padding: 20, position: "fixed", top: 0, left: 0, background: "white", zIndex: 100 }}>
                <button id="reorder-btn" onClick={handleReorder} style={{ marginRight: 10 }}>
                    Reorder Items
                </button>
                <button id="scroll-btn" onClick={handleScrollDown}>
                    Scroll Down
                </button>
                <div>Reordered: <span id="reordered">{reordered ? "true" : "false"}</span></div>
            </div>

            <div style={{ paddingTop: 100 }}>
                {items.map((item) => (
                    <motion.div
                        key={item}
                        ref={item === 3 ? targetRef : undefined}
                        style={{
                            height: 200,
                            margin: 10,
                            padding: 20,
                            backgroundColor: item === 3 ? "red" : "lightgray",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 24,
                        }}
                    >
                        Item {item} {item === 3 && "(tracked)"}
                    </motion.div>
                ))}
            </div>

            <div style={{ height: 500 }} />

            <div
                id="progress"
                style={{
                    position: "fixed",
                    top: 80,
                    left: 0,
                    background: "yellow",
                    padding: "4px 8px",
                    zIndex: 100,
                }}
            >
                Progress: {progress.toFixed(4)}
            </div>
        </>
    )
}
