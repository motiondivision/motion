import { motion } from "framer-motion"
import { useState } from "react"

/**
 * A small child inside a big parent. Both animate layout on a spring with
 * mass: "auto". The child must keep its place in the parent while the
 * animation is interrupted.
 *
 * ?move also moves the child inside the parent. ?still keeps the parent in
 * place, so only the child moves.
 */
const params = new URLSearchParams(window.location.search)

const transition = {
    type: "spring",
    visualDuration: 0.45,
    bounce: 0,
    mass: "auto",
} as const

export const App = () => {
    const [isBig, setIsBig] = useState(false)
    const isMoved = isBig && !params.has("still")
    const size = isMoved ? 600 : 300

    return (
        <motion.div
            id="parent"
            layout
            transition={transition}
            onClick={() => setIsBig(!isBig)}
            style={{
                position: "absolute",
                top: 0,
                left: isMoved ? 200 : 0,
                width: size,
                height: size,
                background: "red",
            }}
        >
            <motion.div
                id="child"
                layout
                transition={transition}
                style={{
                    position: "absolute",
                    top: 20,
                    left: isBig && params.has("move") ? 220 : 20,
                    width: 40,
                    height: 40,
                    background: "blue",
                }}
            />
        </motion.div>
    )
}
