import { motion } from "framer-motion"
import { useEffect, useState } from "react"

export const App = () => {
    const [state, setState] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => {
            setState(!state)
        }, 50)

        return () => {
            clearTimeout(timer)
        }
    }, [])

    return (
        <section
            style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <motion.div
                id="box"
                transition={{ type: "spring" }}
                initial={{ clipPath: "inset(0px)" }}
                animate={{ clipPath: state ? "inset(0px)" : "inset(20px)" }}
                style={{
                    width: "100px",
                    height: "100px",
                    position: "relative",
                    backgroundColor: "red",
                    opacity: 1,
                }}
            >
                Content
            </motion.div>
        </section>
    )
}
