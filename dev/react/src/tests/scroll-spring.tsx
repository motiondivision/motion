import { motion, useScroll, useSpring } from "framer-motion"
import * as React from "react"

export const App = () => {
    const { scrollYProgress } = useScroll()
    const springProgress = useSpring(scrollYProgress, {
        stiffness: 500,
        damping: 60,
        restDelta: 0.001,
    })

    return (
        <>
            <div style={{ ...spacer, backgroundColor: "red" }} />
            <div style={{ ...spacer, backgroundColor: "green" }} />
            <div style={{ ...spacer, backgroundColor: "blue" }} />
            <div style={{ ...spacer, backgroundColor: "yellow" }} />
            <motion.div
                id="progress"
                style={{ ...progressStyle, scaleX: springProgress }}
            >
                {springProgress}
            </motion.div>
        </>
    )
}

const spacer = {
    height: "100vh",
}

const progressStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    background: "white",
    width: "100%",
    height: 100,
}
