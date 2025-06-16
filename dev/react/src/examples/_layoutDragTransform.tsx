import { motion } from "framer-motion"
import { useEffect, useState } from "react"

const transition = {
    default: { duration: 2, ease: "easeInOut" },
    scale: { duration: 0.2 },
}

export const App = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [dragEnabled, setIsDragEnabled] = useState(false)
    const [layoutEnabled, setIsLayoutEnabled] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setIsOpen(!isOpen), 2000)
        return () => clearTimeout(timer)
    }, [isOpen])

    return (
        <>
            <motion.div
                layout
                transition={transition}
                initial={{ borderRadius: 10 }}
                style={{
                    background: "white",
                    padding: "20px",
                    display: "flex",
                    width: isOpen ? "500px" : "200px",
                    height: isOpen ? "100px" : "200px",
                    justifyContent: isOpen ? "flex-end" : undefined,
                    alignItems: !isOpen ? "flex-end" : undefined,
                }}
            >
                <motion.div
                    layout
                    drag
                    transition={transition}
                    onClick={() => setIsOpen(!isOpen)}
                    initial={{ borderRadius: "50%" }}
                    whileHover={{ scale: 1.13 }}
                    id="child"
                    style={{
                        background: "rgb(255, 0, 136)",
                        cursor: "pointer",
                        width: "50px",
                        height: "50px",
                    }}
                />
            </motion.div>
            <motion.div
                style={{
                    fontFamily: "Dank Mono",
                    color: "white",
                    fontWeight: "bold",
                    position: "fixed",
                    bottom: "50px",
                    width: "100%",
                    textAlign: "center",
                    fontSize: "36px",
                }}
            >
                {"layout={true} drag={true}"}
            </motion.div>
        </>
    )
}
