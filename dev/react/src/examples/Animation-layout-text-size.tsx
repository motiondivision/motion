import { motion, useCycle } from "framer-motion"

export const App = () => {
    const [isOn, toggleOn] = useCycle(false, true)

    return (
        <div style={{ color: "white" }} onClick={() => toggleOn()}>
            <motion.p
                layout
                style={{
                    fontSize: isOn ? 100 : 24,
                    fontWeight: "bold",
                    fontFamily: "Helvetica",
                }}
            >
                TEXT
            </motion.p>
        </div>
    )
}
