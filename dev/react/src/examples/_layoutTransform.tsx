import { motion } from "framer-motion"
import { useState } from "react"

const transition = { default: { duration: 5 }, scale: { duration: 0.2 } }

export const App = () => {
    const [isOpen, setIsOpen] = useState(false)
    return (
        <motion.div
            layout
            transition={transition}
            initial={{ borderRadius: 10 }}
            style={{
                background: "white",
                padding: "20px",
                display: "flex",
                width: isOpen ? "300px" : "200px",
                height: isOpen ? "200px" : "400px",
                justifyContent: isOpen ? "flex-end" : undefined,
                alignItems: !isOpen ? "flex-end" : undefined,
            }}
        >
            <motion.div
                layout
                transition={transition}
                onClick={() => setIsOpen(!isOpen)}
                initial={{ borderRadius: 20 }}
                //whileHover={{ scale: 1.13 }}
                id="child"
                style={{
                    background: "rgb(255, 0, 136)",
                    cursor: "pointer",
                    width: isOpen ? "30px" : "100%",
                    height: isOpen ? "30px" : "40px",
                }}
            />
        </motion.div>
    )
}
