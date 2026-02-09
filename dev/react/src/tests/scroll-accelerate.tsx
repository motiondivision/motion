import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useEffect, useRef } from "react"

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

    const directRef = useRef<HTMLDivElement>(null)
    const chainedRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        requestAnimationFrame(() => {
            if (directRef.current) {
                document.getElementById("direct-count")!.innerText =
                    String(directRef.current.getAnimations().length)
            }
            if (chainedRef.current) {
                document.getElementById("chained-count")!.innerText =
                    String(chainedRef.current.getAnimations().length)
            }
        })
    }, [])

    return (
        <>
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <div style={spacer} />
            <motion.div
                ref={directRef}
                id="direct"
                style={{ ...box, opacity, backgroundColor }}
            >
                <span id="direct-count">-1</span>
            </motion.div>
            <motion.div
                ref={chainedRef}
                id="chained"
                style={{ ...box, opacity: chainedOpacity }}
            >
                <span id="chained-count">-1</span>
            </motion.div>
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
