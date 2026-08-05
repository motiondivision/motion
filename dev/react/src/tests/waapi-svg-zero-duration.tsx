import { motion } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [hidden, setHidden] = useState(false)

    return (
        <>
            <button id="toggle" onClick={() => setHidden(!hidden)}>
                toggle
            </button>
            <svg height={60} width={200}>
                <motion.foreignObject
                    id="chip"
                    animate={{ opacity: hidden ? 0 : 1 }}
                    height={40}
                    initial={false}
                    transition={
                        hidden
                            ? { duration: 0.3 }
                            : { duration: 0.3, opacity: { duration: 0 } }
                    }
                    width={100}
                    x={10}
                    y={10}
                >
                    <div style={{ background: "red" }}>chip</div>
                </motion.foreignObject>
            </svg>
        </>
    )
}
