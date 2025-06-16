import { motion, useMotionValue } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const params = new URLSearchParams(window.location.search)
    const type = params.get("type") || true
    const [state, setState] = useState(true)
    const backgroundColor = useMotionValue("#f00")

    return (
        <motion.div
            key={state ? "a" : "b"}
            id={state ? "a" : "b"}
            data-testid="box"
            layoutId="box"
            layout={type}
            style={{
                ...(state ? a : b),
                backgroundColor,
                borderRadius: state ? 0 : 20,
                opacity: state ? 0.4 : 1,
            }}
            onClick={() => setState(!state)}
            transition={{ duration: 1, ease: () => 0.5 }}
            onLayoutAnimationStart={() => backgroundColor.set("#0f0")}
            onLayoutAnimationComplete={() => backgroundColor.set("#00f")}
        />
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
