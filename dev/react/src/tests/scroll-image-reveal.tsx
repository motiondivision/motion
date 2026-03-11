import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useRef } from "react"

const colors = ["#e63946", "#457b9d", "#2a9d8f", "#e9c46a", "#f4a261", "#264653"]

function RevealImage({
    color,
    index,
    aspectRatio,
}: {
    color: string
    index: number
    aspectRatio: string
}) {
    const ref = useRef(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    })

    const clipPath = useTransform(
        scrollYProgress,
        [0, 0.4],
        ["inset(0% 50% 0% 50%)", "inset(0% 0% 0% 0%)"]
    )

    const scale = useTransform(scrollYProgress, [0, 0.4, 1], [1.3, 1, 1.1])
    const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"])

    return (
        <div ref={ref} style={containerStyle}>
            <motion.div
                id={`reveal-${index}`}
                style={{ ...maskStyle, clipPath, aspectRatio }}
            >
                <motion.div
                    style={{
                        ...imgStyle,
                        background: color,
                        scale,
                        y,
                    }}
                >
                    <span style={labelStyle}>{index + 1}</span>
                </motion.div>
            </motion.div>
        </div>
    )
}

export const App = () => {
    return (
        <div style={{ background: "#f5f5f5" }}>
            <div style={introStyle}>
                <h1 style={headingStyle}>Scroll Image Reveal</h1>
            </div>

            {colors.map((color, i) => (
                <RevealImage
                    key={i}
                    color={color}
                    index={i}
                    aspectRatio={i % 2 === 0 ? "4 / 3" : "3 / 4"}
                />
            ))}

            <div style={{ height: "30vh" }} />
        </div>
    )
}

const introStyle: React.CSSProperties = {
    height: "50vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
}
const headingStyle: React.CSSProperties = {
    fontSize: "clamp(36px, 8vw, 72px)",
    color: "#0f1115",
    margin: 0,
    textTransform: "uppercase",
}
const containerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 800,
    margin: "0 auto",
    padding: 20,
}
const maskStyle: React.CSSProperties = {
    width: "100%",
    overflow: "hidden",
    borderRadius: 8,
}
const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
}
const labelStyle: React.CSSProperties = {
    fontSize: 64,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.5)",
}
