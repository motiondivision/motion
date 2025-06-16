import { motion } from "framer-motion"
import { useState } from "react"

const transition = {
    default: { duration: 1, ease: () => 0.5 },
    opacity: { duration: 1, ease: () => 0.1 },
}

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get("type") || true
    const size = params.get("size") || false
    const move = params.get("move") || "yes"
    const [state, setState] = useState(false)

    const bStyle = size ? aLarge : b
    if (move === "no") {
        bStyle.top = bStyle.left = 0
    }

    return (
        <>
            <motion.div
                id="a"
                layoutId="box"
                layout={type}
                style={a}
                onClick={() => setState(!state)}
                transition={transition}
            />
            {state && (
                <motion.div
                    id="b"
                    layoutId="box"
                    layout={type}
                    style={bStyle}
                    transition={transition}
                    onClick={() => setState(!state)}
                />
            )}
        </>
    )
}

const box = {
    position: "absolute",
    top: 0,
    left: 0,
    background: "red",
}

const a = {
    ...box,
    width: 100,
    height: 200,
}

const b = {
    ...box,
    top: 100,
    left: 200,
    width: 300,
    height: 300,
}

const aLarge = {
    ...box,
    top: 100,
    left: 200,
    width: 300,
    height: 600,
}
