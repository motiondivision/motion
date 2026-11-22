import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"

/**
 * Parallax: transforms that follow scroll progress, alone and alongside
 * another transform and opacity.
 */
export const App = () => {
    const { scrollYProgress } = useScroll()
    const y = useTransform(scrollYProgress, [0, 1], [0, 200])
    const x = useTransform(scrollYProgress, [0, 1], [0, 100])
    const rotate = useTransform(scrollYProgress, [0, 1], [0, 90])
    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0.5])

    return (
        <>
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <motion.div id="y" style={{ ...box, y }} />
            <motion.div
                id="combined"
                style={{ ...box, left: 150, x, rotate, opacity, scale: 0.5 }}
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
