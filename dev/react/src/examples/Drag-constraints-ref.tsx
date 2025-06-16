import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"

const container = {
    width: "50%",
    height: 300,
    background: "rgba(255,255,255,0.5)",
    borderRadius: 20,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
}

const child = {
    width: 200,
    height: 200,
    background: "white",
    borderRadius: 20,
}

/**
 * This sibling layout animation is designed to fuzz/stress the drag constraints
 * measurements. Remeasuring the constraints during drag would previously mess
 * up the position of the draggable element.
 */
const SiblingLayoutAnimation = () => {
    const [state, setState] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setState(!state), 500)

        return () => clearTimeout(timer)
    }, [state])

    return (
        <motion.div
            layout
            style={{
                ...child,
                background: "blue",
                position: "relative",
                left: state ? "100px" : "0",
            }}
        />
    )
}

export const App = () => {
    const ref = useRef(null)
    const [count, setCount] = useState(0)
    return (
        <>
            <div ref={ref} style={container}>
                <motion.div
                    drag
                    dragConstraints={ref}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.1 }}
                    style={child}
                    onClick={() => setCount(count + 1)}
                    id="draggable"
                />
            </div>
            <SiblingLayoutAnimation />
        </>
    )
}
