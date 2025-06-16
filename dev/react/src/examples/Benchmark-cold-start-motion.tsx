import { motion } from "framer-motion"

/**
    Cold Start: Motion

    This benchmarks cold start - when an animation library has to
    read values from the DOM.

    Run in private browsing mode to avoid browser plugins interfering with
    benchmark.
 */

const box = {
    width: 10,
    height: 100,
    backgroundColor: "#fff",
}

const boxContainer = {
    width: 100,
    height: 100,
}

const num = 100
const transition = {
    easing: "linear",
    duration: 1,
}

function Box() {
    return (
        <div style={boxContainer}>
            <motion.div
                style={box}
                animate={{
                    rotate: Math.random() * 360,
                    backgroundColor: "#f00",
                    width: Math.random() * 100 + "%",
                    x: 5,
                }}
                transition={transition}
            />
        </div>
    )
}

export const App = () => {
    const children = []

    for (let i = 0; i < num; i++) {
        children.push(<Box />)
    }

    return (
        <div
            style={{
                padding: 100,
                width: "100%",
                display: "flex",
                flexWrap: "wrap",
            }}
        >
            {children}
        </div>
    )
}
