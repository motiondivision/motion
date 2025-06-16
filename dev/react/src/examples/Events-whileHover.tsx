import { motion } from "framer-motion"
import { useState } from "react"

export function App() {
    const [scale, setScale] = useState(2)
    return (
        <motion.div
            whileHover={{
                opacity: 0.5,
            }}
            onClick={() => setScale(scale + 1)}
            style={{ width: 100, height: 100, background: "white" }}
            transition={{
                type: "spring",
                mass: 1,
                damping: 10,
                stiffness: 60,
                restDelta: 0.00001,
                restSpeed: 0.00001,
            }}
        />
    )
}
