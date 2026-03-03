import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"

export const App = () => {
    const { scrollYProgress } = useScroll()
    const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])
    const scale = useTransform(scrollYProgress, [0, 1], [0.5, 1])

    return (
        <>
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <motion.div
                id="target"
                style={{ ...box, opacity, scale }}
            />
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
    background: "red",
}
