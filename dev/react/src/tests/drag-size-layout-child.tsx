import { motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * A dragged element with layout="size" moves (pressing "t" toggles its
 * margin). Its `layout` child has a long linear transition, so if the child
 * layout animated instead of moving with its parent, it would visibly lag.
 */
export const App = () => {
    const [moved, setMoved] = useState(false)

    useEffect(() => {
        const toggle = (e: KeyboardEvent) =>
            e.key === "t" && setMoved((m) => !m)
        window.addEventListener("keydown", toggle)
        return () => window.removeEventListener("keydown", toggle)
    }, [])

    return (
        <motion.div
            id="parent"
            drag
            layout="size"
            style={{
                width: 300,
                height: 200,
                marginTop: moved ? 300 : 50,
                marginLeft: 50,
                background: "#eee",
            }}
        >
            <motion.div
                id="child"
                layout
                transition={{ duration: 10, ease: "linear" }}
                style={{ width: 50, height: 50, background: "red" }}
            />
        </motion.div>
    )
}
