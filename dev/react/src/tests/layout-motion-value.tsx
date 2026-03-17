import { motion, useMotionValue } from "framer-motion"

export const App = () => {
    const width = useMotionValue(100)

    return (
        <>
            <motion.div
                id="box"
                layout
                style={{
                    width,
                    height: 100,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    background: "red",
                }}
                transition={{ duration: 0.5, ease: () => 0.5 }}
            />
            <button
                id="toggle"
                style={{ position: "absolute", top: 200 }}
                onClick={() => width.set(width.get() === 100 ? 300 : 100)}
            >
                Toggle
            </button>
        </>
    )
}
