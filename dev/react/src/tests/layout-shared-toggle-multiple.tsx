import { motion, MotionConfig } from "framer-motion"
import { useState } from "react"

export const App = () => {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <MotionConfig transition={{ duration: 1 }}>
            <button style={button} onClick={() => setIsOpen(!isOpen)}>
                Toggle
            </button>

            <motion.div layoutId="box" id="a" style={box} />
            {isOpen ? (
                <motion.div layoutId="box" id="b" style={openBox} />
            ) : null}
        </MotionConfig>
    )
}

const button = {
    position: "fixed",
    top: 0,
    left: 300,
}

const box = {
    width: 100,
    height: 100,
    background: "red",
    borderRadius: 20,
}

const openBox = {
    width: 200,
    height: 200,
    background: "blue",
}
