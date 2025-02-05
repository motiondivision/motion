import { motion, MotionConfig } from "framer-motion"
import { useState } from "react"

const transition = {
    // ease: () => 0.5,
    duration: 10,
}

function BoxA({ isOpen }: { isOpen: boolean }) {
    return (
        <div style={container}>
            <motion.div
                style={{ ...a, borderRadius: 24 }}
                transition={transition}
                layoutId="boxA"
            />
            {isOpen && (
                <motion.div
                    className="measure-box"
                    style={{ ...b, borderRadius: 0 }}
                    transition={transition}
                    layoutId="boxA"
                />
            )}
        </div>
    )
}

function BoxB({ isOpen }: { isOpen: boolean }) {
    return (
        <div style={container}>
            {!isOpen ? (
                <motion.div
                    key="a"
                    style={{ ...a, borderRadius: 24 }}
                    transition={transition}
                    layoutId="boxB"
                />
            ) : (
                <motion.div
                    key="b"
                    className="measure-box"
                    style={{ ...b, borderRadius: 0 }}
                    transition={transition}
                    layoutId="boxB"
                />
            )}
        </div>
    )
}

export const App = () => {
    const [isOpen, setOpen] = useState(false)

    return (
        <MotionConfig transition={{ duration: 1 }}>
            <button id="next" onClick={() => setOpen(!isOpen)}>
                Next
            </button>
            <BoxA isOpen={isOpen} />
            <BoxB isOpen={isOpen} />
        </MotionConfig>
    )
}

const box = {
    background: "red",
    gridArea: "1 / 1",
}

const container = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    width: 300,
    height: 300,
}

const a = {
    ...box,
    width: 80,
    height: 80,
}

const b = {
    ...box,
    left: 200,
    width: 140,
    height: 140,
}
