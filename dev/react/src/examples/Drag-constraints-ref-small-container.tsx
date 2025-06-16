import { useRef } from "react"
import { motion } from "framer-motion"

const container = {
    width: 200,
    height: 200,
    background: "rgba(255,255,255,0.5)",
    borderRadius: 20,
}

const child = {
    width: "50vw",
    height: 300,
    background: "white",
    borderRadius: 20,
}

export const App = () => {
    const ref = useRef(null)
    return (
        <div ref={ref} style={container}>
            <motion.div
                drag
                dragConstraints={ref}
                whileTap={{ scale: 0.95 }}
                style={child}
            />
        </div>
    )
}
