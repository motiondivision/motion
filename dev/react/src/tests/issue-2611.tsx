import { motion } from "framer-motion"
import { useState } from "react"

/**
 * #2611: rotateZ is lost during and after a shared layout animation,
 * whereas rotate works.
 */
const box = { width: 100, height: 100, background: "red" }

export const App = () => {
    const [open, setOpen] = useState(false)
    const params = new URLSearchParams(window.location.search)
    const prop = params.get("prop") || "rotateZ"

    return (
        <div onClick={() => setOpen(!open)}>
            {open ? (
                <motion.div
                    key="b"
                    id="box"
                    layoutId="card"
                    animate={{ [prop]: 45 }}
                    transition={{ duration: 0.5, ease: "linear" }}
                    style={{ ...box, position: "absolute", left: 300, top: 200 }}
                />
            ) : (
                <motion.div
                    key="a"
                    id="box"
                    layoutId="card"
                    animate={{ [prop]: 45 }}
                    transition={{ duration: 0.5, ease: "linear" }}
                    style={{ ...box, position: "absolute", left: 50, top: 50 }}
                />
            )}
        </div>
    )
}
