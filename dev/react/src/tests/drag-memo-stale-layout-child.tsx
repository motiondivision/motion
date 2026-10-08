import { motion } from "framer-motion"
import { memo, useEffect, useState } from "react"

/**
 * The dragged element is memoized, so only its child re-renders when the
 * switch is toggled ("t"). ?parentLayout=true gives the dragged element
 * `layout` too.
 */
const Handle = () => {
    const [isOn, setIsOn] = useState(false)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "t" && setIsOn((v) => !v)
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])
    return (
        <div
            style={{
                display: "flex",
                width: 400,
                justifyContent: isOn ? "flex-end" : "flex-start",
            }}
        >
            <motion.div
                id="handle"
                layout
                transition={{ type: "tween", ease: "linear", duration: 10 }}
                style={{ width: 100, height: 100, background: "red" }}
            />
        </div>
    )
}

const Card = memo(({ parentLayout }: { parentLayout?: boolean }) => (
    <motion.div
        id="switch"
        drag
        layout={parentLayout}
        dragMomentum={false}
        style={{ width: 400, height: 100, background: "#ccc" }}
    >
        <Handle />
    </motion.div>
))

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const parentLayout = params.get("parentLayout") === "true" || undefined
    return (
        <>
            <div id="spacer" style={{ height: 50 }} />
            <Card parentLayout={parentLayout} />
        </>
    )
}
