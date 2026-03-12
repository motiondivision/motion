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

export const App = () => {
    const [show, setShow] = useState(true)

    return (
        <div id="container" style={containerStyles}>
            <button id="toggle" onClick={() => setShow(!show)}>
                Toggle
            </button>
            <AnimatePresence mode="popLayout">
                <motion.div
                    key="a"
                    id="a"
                    layout
                    style={boxStyles}
                />
                {show ? (
                    <motion.div
                        key="target"
                        id="target"
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{
                            opacity: 0,
                            transition: { duration: 10 },
                        }}
                        style={{
                            ...boxStyles,
                            backgroundColor: "green",
                        }}
                    />
                ) : null}
                <motion.div
                    key="c"
                    id="c"
                    layout
                    style={{
                        ...boxStyles,
                        backgroundColor: "blue",
                    }}
                />
            </AnimatePresence>
        </div>
    )
}
