import { motion, useMotionValue } from "framer-motion"
import { useRef, useState, useLayoutEffect, useEffect } from "react"

// It's important for this test to only trigger a single rerender while dragging (in response to onDragStart) of draggable component.

export const App = () => {
    const containerRef = useRef(null)
    const [dragging, setDragging] = useState(false)
    const params = new URLSearchParams(window.location.search)
    const layout = params.get("layout") || undefined
    const elastic = Number(params.get("elastic")) || 0

    // We do this to test when scroll position isn't 0/0
    useLayoutEffect(() => {
        window.scrollTo(0, 100)
    }, [])
    const x = useMotionValue("100%")

    return (
        <>
            <div style={{ height: 2000, paddingTop: 100 }}>
                <motion.div
                    data-testid="constraint"
                    style={{ width: 200, height: 200, background: "blue" }}
                    ref={containerRef}
                >
                    <motion.div
                        id="box"
                        data-testid="draggable"
                        drag
                        dragElastic={elastic}
                        dragMomentum={false}
                        style={{
                            width: 50,
                            height: 50,
                            background: dragging ? "yellow" : "red",
                            x,
                        }}
                        dragConstraints={containerRef}
                        layout={layout}
                        onDragStart={() => setDragging(true)}
                        onDragEnd={() => setDragging(false)}
                    />
                </motion.div>
            </div>
            <SiblingLayoutAnimation />
        </>
    )
}

/**
 * This sibling layout animation is designed to fuzz/stress the drag constraints
 * measurements. Remeasuring the constraints during drag would previously mess
 * up the position of the draggable element.
 */
const SiblingLayoutAnimation = () => {
    const [state, setState] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setState(!state), 200)

        return () => clearTimeout(timer)
    }, [state])

    return (
        <motion.div
            layout
            style={{
                width: 200,
                height: 200,
                borderRadius: 20,
                background: "blue",
                position: "relative",
                left: state ? "100px" : "0",
            }}
        />
    )
}
