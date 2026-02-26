import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useRef } from "react"

export const App = () => {
    const targetRef = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: targetRef,
        offset: ["start end", "end start"],
    })

    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])
    const y = useTransform(scrollYProgress, [0, 1], [0, -100])

    return (
        <>
            <div style={spacer} />
            <div ref={targetRef} style={targetStyle}>
                <motion.div
                    id="target"
                    style={{ ...box, opacity, y }}
                />
            </div>
            <div style={spacer} />
            <div style={spacer} />
            <span id="has-accelerate">
                {scrollYProgress.accelerate ? "true" : "false"}
            </span>
        </>
    )
}

const spacer = { height: "100vh" }
const targetStyle: React.CSSProperties = {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
}
const box: React.CSSProperties = {
    width: 100,
    height: 100,
    background: "red",
}
