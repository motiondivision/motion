import { motion } from "framer-motion"
import { memo, useEffect, useState } from "react"

/**
 * #box is dragged inside #scroller, and memoized, so a render elsewhere
 * ("r" re-renders #other) measures layout without re-rendering it.
 *
 * ?layout or ?layoutId give #box that prop, ?layoutScroll gives it to
 * #scroller, ?parentX moves #box's parent with a transform, and ?child
 * gives #box a `layout` child.
 */
const params = new URLSearchParams(window.location.search)

const Box = memo(() => (
    <motion.div
        id="box"
        drag
        dragMomentum={false}
        layout={params.has("layout")}
        layoutId={params.has("layoutId") ? "box" : undefined}
        style={{ width: 100, height: 100, background: "red" }}
    >
        {params.has("child") && (
            <motion.div
                id="child"
                layout
                style={{ width: 20, height: 20, background: "white" }}
            />
        )}
    </motion.div>
))

const Other = () => {
    const [count, setCount] = useState(0)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) =>
            e.key === "r" && setCount((c) => c + 1)
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])
    return (
        <motion.div
            id="other"
            layout
            data-count={count}
            style={{ width: 50, height: 50, background: "blue" }}
        />
    )
}

export const App = () => (
    <>
        <Other />
        <motion.div
            id="scroller"
            layoutScroll={params.has("layoutScroll")}
            style={{ width: 400, height: 300, overflow: "auto" }}
        >
            <motion.div
                style={{
                    x: params.has("parentX") ? 20 : 0,
                    width: 1000,
                    height: 1000,
                    padding: 50,
                }}
            >
                <Box />
            </motion.div>
        </motion.div>
    </>
)
