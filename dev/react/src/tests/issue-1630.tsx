import { motion } from "framer-motion"
import { useEffect, useState } from "react"

/**
 * Issue #1630: layout animation of a child is ignored while its draggable
 * parent is being dragged. Based on the "framer-motion 2 layout animations"
 * switch sandbox, with the switch container made draggable.
 * ?drag=false -> parent not draggable (control).
 * Press "t" to toggle the switch (so it can be toggled mid-drag).
 */
export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const draggable = params.get("drag") !== "false"
    const [isOn, setIsOn] = useState(false)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "t" && setIsOn((v) => !v)
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    return (
        <motion.div
            id="switch"
            drag={draggable}
            dragMomentum={false}
            style={{
                position: "absolute",
                top: 100,
                left: 100,
                width: 400,
                height: 100,
                background: "#ccc",
                display: "flex",
                justifyContent: isOn ? "flex-end" : "flex-start",
            }}
        >
            <motion.div
                id="handle"
                layout
                transition={{ type: "tween", ease: "linear", duration: 10 }}
                style={{ width: 100, height: 100, background: "red" }}
            />
        </motion.div>
    )
}
