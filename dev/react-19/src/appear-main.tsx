/**
 * Page for tests/react/appear.spec.ts. It has its own entry, as the main
 * one imports every test page and the animation features with them.
 */
import { motion } from "framer-motion/appear"
import { useEffect, useState } from "react"
import ReactDOMClient from "react-dom/client"

const linear = { type: "tween", ease: "linear", duration: 4 } as const
const box = { width: 100, height: 100, background: "#f00" }

/**
 * Its target changes before the animation code can have arrived.
 */
const Changing = () => {
    const [x, setX] = useState(0)

    useEffect(() => {
        const timer = setTimeout(() => setX(200), 300)
        return () => clearTimeout(timer)
    }, [])

    return (
        <motion.div
            id="changing"
            initial={{ x: -400 }}
            animate={{ x }}
            transition={linear}
            style={box}
        />
    )
}

const App = () => (
    <>
        <motion.div
            id="independent"
            initial={{ x: -400, scale: 0.5 }}
            animate={{ x: 0, scale: 1 }}
            transition={{ x: linear, scale: { ...linear, duration: 1 } }}
            style={box}
        />
        <Changing />
        <motion.div
            id="tween"
            initial={{ opacity: 0, x: -400 }}
            animate={{ opacity: 1, x: 0 }}
            transition={linear}
            style={box}
        />
        <motion.div
            id="spring"
            initial={{ x: -400 }}
            animate={{ x: 0 }}
            style={box}
        />
        <motion.div
            id="colour"
            initial={{ backgroundColor: "#ff0000" }}
            animate={{ backgroundColor: "#0000ff" }}
            transition={linear}
            style={box}
        />
        <motion.div
            id="hover"
            initial={{ x: -400, scale: 0.5 }}
            animate={{ x: 0, scale: 1 }}
            whileHover={{ scale: 2 }}
            transition={linear}
            style={{ ...box, marginLeft: 500 }}
        />
        <motion.div
            id="keyframes"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 1] }}
            transition={linear}
            style={box}
        />
    </>
)

ReactDOMClient.createRoot(document.getElementById("root")!).render(<App />)
