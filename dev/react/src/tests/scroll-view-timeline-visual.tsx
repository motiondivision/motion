import { motion, useScroll, useTransform } from "framer-motion"
import * as React from "react"
import { useRef } from "react"

const colors = {
    entry: "#3b82f6",
    exit: "#ef4444",
    cover: "#8b5cf6",
    contain: "#10b981",
}

/**
 * Entry: [[0,1],[1,1]] — fades in as element enters from below
 */
const EntryRange = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: [
            [0, 1],
            [1, 1],
        ],
    })
    const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])
    const transform = useTransform(
        scrollYProgress,
        (v) => `translateY(${60 * (1 - v)}px)`
    )
    return (
        <div style={targetStyle}>
            <div style={label}>entry — fade in from below</div>
            <motion.div
                ref={ref}
                id="entry"
                style={{ ...box, background: colors.entry, opacity, transform }}
            />
            <ProgressBar progress={scrollYProgress} color={colors.entry} />
        </div>
    )
}

/**
 * Exit: [[0,0],[1,0]] — fades out as element exits above
 */
const ExitRange = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: [
            [0, 0],
            [1, 0],
        ],
    })
    const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])
    const transform = useTransform(
        scrollYProgress,
        (v) => `translateY(${-60 * v}px)`
    )
    return (
        <div style={targetStyle}>
            <div style={label}>exit — fade out above</div>
            <motion.div
                ref={ref}
                id="exit"
                style={{ ...box, background: colors.exit, opacity, transform }}
            />
            <ProgressBar progress={scrollYProgress} color={colors.exit} />
        </div>
    )
}

/**
 * Cover: [[1,0],[0,1]] — visible the entire time it crosses the viewport
 */
const CoverRange = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: [
            [1, 0],
            [0, 1],
        ],
    })
    const opacity = useTransform(
        scrollYProgress,
        [0, 0.3, 0.7, 1],
        [0, 1, 1, 0]
    )
    const transform = useTransform(scrollYProgress, (v) => {
        const s = v < 0.3 ? 0.5 + (v / 0.3) * 0.5 : v > 0.7 ? 1 - ((v - 0.7) / 0.3) * 0.5 : 1
        return `scale(${s})`
    })
    return (
        <div style={targetStyle}>
            <div style={label}>cover — fade in & out across full crossing</div>
            <motion.div
                ref={ref}
                id="cover"
                style={{ ...box, background: colors.cover, opacity, transform }}
            />
            <ProgressBar progress={scrollYProgress} color={colors.cover} />
        </div>
    )
}

/**
 * Contain (default): [[0,0],[1,1]] — animates while fully contained in viewport
 */
const ContainRange = () => {
    const ref = useRef<HTMLDivElement>(null)
    const { scrollYProgress } = useScroll({ target: ref })
    const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 0])
    const transform = useTransform(
        scrollYProgress,
        (v) => `translateX(${-100 + 200 * v}px)`
    )
    return (
        <div style={targetStyle}>
            <div style={label}>contain (default) — slide while fully inside</div>
            <motion.div
                ref={ref}
                id="contain"
                style={{ ...box, background: colors.contain, opacity, transform }}
            />
            <ProgressBar progress={scrollYProgress} color={colors.contain} />
        </div>
    )
}

const ProgressBar = ({
    progress,
    color,
}: {
    progress: ReturnType<typeof useScroll>["scrollYProgress"]
    color: string
}) => {
    const width = useTransform(progress, [0, 1], ["0%", "100%"])
    return (
        <div style={barTrack}>
            <motion.div style={{ ...barFill, background: color, width }} />
        </div>
    )
}

export const App = () => {
    return (
        <div style={{ background: "#111", color: "#fff", minHeight: "100vh" }}>
            <div style={hero}>Scroll down</div>
            <EntryRange />
            <div style={spacer} />
            <ExitRange />
            <div style={spacer} />
            <CoverRange />
            <div style={spacer} />
            <ContainRange />
            <div style={spacer} />
        </div>
    )
}

const spacer: React.CSSProperties = { height: "100vh" }
const hero: React.CSSProperties = {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    opacity: 0.5,
}
const targetStyle: React.CSSProperties = {
    height: "60vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 16,
    position: "relative",
}
const label: React.CSSProperties = {
    fontSize: 14,
    opacity: 0.6,
    fontFamily: "monospace",
}
const box: React.CSSProperties = {
    width: 120,
    height: 120,
    borderRadius: 16,
}
const barTrack: React.CSSProperties = {
    width: 200,
    height: 4,
    background: "#333",
    borderRadius: 2,
    overflow: "hidden",
}
const barFill: React.CSSProperties = {
    height: "100%",
    borderRadius: 2,
}
