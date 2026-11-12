import { motion } from "framer-motion"
import { useState } from "react"

/**
 * The box has no width while it moves, then gets a width while it's still
 * moving. The animation must still complete.
 */
const states = [
    { left: 100, width: 0 },
    { left: 400, width: 0 },
    { left: 400, width: 200 },
]

export const App = () => {
    const [i, setI] = useState(0)
    const [completed, setCompleted] = useState(0)

    return (
        <motion.div
            id="box"
            layout
            data-completed={completed}
            transition={{ type: "spring", visualDuration: 0.4, bounce: 0 }}
            onLayoutAnimationComplete={() => setCompleted((c) => c + 1)}
            onClick={() => setI(Math.min(i + 1, 2))}
            style={{
                position: "absolute",
                top: 100,
                height: 100,
                background: "red",
                ...states[i],
            }}
        />
    )
}
