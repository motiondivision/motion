import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useRef } from "react"

/**
 * Default offset (All preset / contain range)
 */
const DefaultTarget = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: ref })
    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])
    return (
        <div ref={ref} style={targetStyle}>
            <motion.div id="default-target" style={{ ...box, opacity }} />
            <span id="default-accelerate">
                {scrollYProgress.accelerate ? "true" : "false"}
            </span>
        </div>
    )
}

/**
 * Enter preset offset — [[0,1],[1,1]]
 */
const EnterTarget = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: [
            [0, 1],
            [1, 1],
        ],
    })
    const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])
    return (
        <div ref={ref} style={targetStyle}>
            <motion.div id="enter-target" style={{ ...box, opacity }} />
            <span id="enter-accelerate">
                {scrollYProgress.accelerate ? "true" : "false"}
            </span>
        </div>
    )
}

/**
 * String offset — should NOT accelerate
 */
const StringOffsetTarget = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    })
    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])
    return (
        <div ref={ref} style={targetStyle}>
            <motion.div id="string-target" style={{ ...box, opacity }} />
            <span id="string-accelerate">
                {scrollYProgress.accelerate ? "true" : "false"}
            </span>
        </div>
    )
}

export const App = () => {
    return (
        <>
            <div style={spacer} />
            <DefaultTarget />
            <div style={spacer} />
            <EnterTarget />
            <div style={spacer} />
            <StringOffsetTarget />
            <div style={spacer} />
        </>
    )
}

const spacer = { height: "100vh" }
const targetStyle: React.CSSProperties = {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
}
const box: React.CSSProperties = {
    width: 100,
    height: 100,
    background: "red",
}
