import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"

export const App = () => {
    const { scrollYProgress } = useScroll()
    const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0])
    const backgroundColor = useTransform(
        scrollYProgress,
        [0, 1],
        ["#ff0000", "#0000ff"]
    )

    const intermediate = useTransform(scrollYProgress, [0, 1], [1, 0.5])
    const chainedOpacity = useTransform(intermediate, [1, 0.75], [0, 1])

    return (
        <>
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <motion.div
                id="direct"
                style={{ ...box, opacity, backgroundColor }}
            />
            <motion.div
                id="chained"
                style={{ ...box, opacity: chainedOpacity, top: 110 }}
            />
            <span id="direct-accelerated">
                {opacity.accelerate ? "true" : "false"}
            </span>
            <span id="chained-accelerated">
                {chainedOpacity.accelerate ? "true" : "false"}
            </span>
            <span id="bg-accelerated">
                {backgroundColor.accelerate ? "true" : "false"}
            </span>
        </>
    )
}

const spacer = { height: "100vh" }
const box: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: 100,
    height: 100,
}
