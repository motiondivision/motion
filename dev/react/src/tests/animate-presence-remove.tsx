import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"

const containerStyles = {
    position: "relative" as const,
    display: "flex",
    flexDirection: "column" as const,
    padding: "100px",
}

const boxStyles = {
    width: "100px",
    height: "100px",
    backgroundColor: "red",
}

const Box = ({ id }: { id: number }) => {
    return (
        <motion.div
            id={`box-${id}`}
            className="box"
            style={boxStyles}
            transition={{ duration: 0.5 }}
            exit={{ opacity: 0.5 }}
        />
    )
}

export const App = () => {
    const [range, setRange] = useState([0, 1, 2])

    return (
        <div style={containerStyles}>
            <button id="remove" onClick={() => setRange(range.slice(0, -1))}>
                Remove
            </button>
            <AnimatePresence>
                {range.map((i) => (
                    <Box key={i} id={i} />
                ))}
            </AnimatePresence>
        </div>
    )
}
