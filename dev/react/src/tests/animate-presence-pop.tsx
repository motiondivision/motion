import { animate, AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"

const containerStyles = {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    padding: "100px",
}

const boxStyles = {
    width: "100px",
    height: "100px",
    backgroundColor: "red",
}

type Position = "static" | "relative" | "absolute" | "fixed"
type Anchor = "left" | "right"

export const App = () => {
    const [state, setState] = useState(true)
    const params = new URLSearchParams(window.location.search)
    const position = (params.get("position") || "static") as Position
    const anchorX = (params.get("anchor-x") || "left") as Anchor
    const itemStyle =
        position === "relative" ? { position, top: 100, left: 100 } : {}

    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!ref.current) return

        animate(ref.current, { opacity: [0, 1] }, { duration: 1 })
        animate(ref.current, { opacity: [1, 0.5] }, { duration: 1 })
    }, [])

    return (
        <div style={containerStyles} onClick={() => setState(!state)}>
            <AnimatePresence anchorX={anchorX} mode="popLayout">
                <motion.div
                    key="a"
                    id="a"
                    layout
                    transition={{ ease: () => 1 }}
                    style={{ ...boxStyles, ...itemStyle }}
                />
                {state ? (
                    <motion.div
                        key="b"
                        id="b"
                        animate={{
                            opacity: 1,
                            transition: { duration: 0.001 },
                        }}
                        exit={{ opacity: 0, transition: { duration: 10 } }}
                        layout
                        style={{
                            ...boxStyles,
                            ...itemStyle,
                            backgroundColor: "green",
                        }}
                    />
                ) : null}
                <motion.div
                    key="c"
                    id="c"
                    layout
                    transition={{ ease: () => 1 }}
                    style={{
                        ...boxStyles,
                        ...itemStyle,
                        backgroundColor: "blue",
                    }}
                />
            </AnimatePresence>
            <div
                ref={ref}
                style={{
                    ...boxStyles,
                    ...itemStyle,
                    backgroundColor: "purple",
                }}
            />
        </div>
    )
}
