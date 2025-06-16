import { motion } from "framer-motion"
import { useState } from "react";

export const App = () => {
    const [count, setCount] = useState(0)

    return (
        <motion.div
            id="box"
            data-testid="box"
            layout
            style={count === 0 ? a : b}
            onClick={() => setCount(count + 1)}
            transition={{ duration: 10, ease: () => 0.5 }}
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
