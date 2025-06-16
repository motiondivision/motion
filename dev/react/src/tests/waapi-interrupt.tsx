import { motion } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [state, setState] = useState(false)

    return (
        <section
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                padding: "100px",
            }}
        >
            <motion.div
                id="box"
                transition={{ duration: 1 }}
                initial={{ transform: "scale(1)", opacity: 1 }}
                animate={{
                    transform: `scale(${state ? 1 : 2})`,
                    opacity: state ? 1 : 0,
                }}
                onClick={() => setState(!state)}
                style={{
                    width: "100px",
                    height: "100px",
                    position: "relative",
                    top: "100px",
                    left: "100px",
                    backgroundColor: "red",
                    opacity: 1,
                }}
            >
                Content
            </motion.div>
        </section>
    )
}
