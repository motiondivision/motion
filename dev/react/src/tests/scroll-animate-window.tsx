import {
    animate,
    animateMini,
    motion,
    scroll,
    useMotionValue,
    useTransform,
} from "framer-motion"
import * as React from "react"
import { useEffect } from "react"

export const App = () => {
    const progress = useMotionValue(0)

    useEffect(() => {
        const stopScrollAnimation = scroll(
            animate("#color", {
                x: [0, 100],
                opacity: [0, 1],
                backgroundColor: ["#fff", "#000"],
            })
        )

        const stopMiniScrollAnimation = scroll(
            animateMini("#color", {
                color: ["#000", "#fff"],
            })
        )

        const stopMotionValueAnimation = scroll(animate(progress, 100))

        return () => {
            stopScrollAnimation()
            stopMiniScrollAnimation()
            stopMotionValueAnimation()
        }
    }, [])

    const progressDisplay = useTransform(() => Math.round(progress.get()))

    return (
        <>
            <div style={{ ...spacer, backgroundColor: "red" }} />
            <div style={{ ...spacer, backgroundColor: "green" }} />
            <div style={{ ...spacer, backgroundColor: "blue" }} />
            <div style={{ ...spacer, backgroundColor: "yellow" }} />
            <motion.div id="color" style={progressStyle}>
                {progressDisplay}
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
    width: 100,
    height: 100,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: 80,
    lineHeight: 80,
    fontWeight: "bold",
}
