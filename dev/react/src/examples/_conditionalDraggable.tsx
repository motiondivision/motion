import { motion } from "framer-motion"
import { useState } from "react"

const styleA = {
    width: 300,
    height: 300,
    background: "blue",
}
const styleB = {
    width: 100,
    height: 100,
    background: "red",
}

export const App = () => {
    const [drag, setDragEnabled] = useState(true)
    const onTap = () => setDragEnabled(!drag)
    return (
        <>
            <motion.div
                drag={drag}
                style={{ ...styleA, background: drag ? "green" : "yellow" }}
            />
            <motion.div onTap={onTap} style={styleB} />
        </>
    )
}
